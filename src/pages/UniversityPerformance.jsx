import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import axios from "axios";
import "./UniversityPerformance.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const UniversityPerformance = () => {
  const navigate = useNavigate();
  const [historicalData, setHistoricalData] = useState({});
  const [selectedView, setSelectedView] = useState("year");
  const [predictedData, setPredictedData] = useState({});

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
      const binaryStr = event.target.result;
      const workbook = XLSX.read(binaryStr, { type: "binary" });

      const allSheetData = {};
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const parsedData = XLSX.utils.sheet_to_json(sheet);
        const sheetData = processExcelData(parsedData);
        updateHistoricalData(sheetData, allSheetData);
      });

      setHistoricalData(allSheetData);
      await uploadAndPredict(allSheetData);
    };
    reader.readAsBinaryString(file);
  };

  const processExcelData = (rawData) => {
    const groupedData = {};
    rawData.forEach((row) => {
      const { Year, Department, Course, RegNo, Grade, Mark } = row;
      if (!groupedData[Year]) groupedData[Year] = {};
      if (!groupedData[Year][Department]) groupedData[Year][Department] = {};
      if (!groupedData[Year][Department][Course]) groupedData[Year][Department][Course] = [];
      groupedData[Year][Department][Course].push({ RegNo, Grade, Mark });
    });
    return groupedData;
  };

  const updateHistoricalData = (newData, allSheetData) => {
    Object.keys(newData).forEach((year) => {
      if (!allSheetData[year]) allSheetData[year] = {};
      Object.keys(newData[year]).forEach((dept) => {
        if (!allSheetData[year][dept]) allSheetData[year][dept] = {};
        Object.assign(allSheetData[year][dept], newData[year][dept]);
      });
    });
  };

  const calculateCO = (students) => {
    const totalMarks = students.reduce((sum, student) => sum + (student.Mark || 0), 0);
    const totalStudents = students.length;
    return totalStudents > 0 ? (totalMarks / totalStudents).toFixed(2) : 0;
  };

  const uploadAndPredict = async (data) => {
    try {
      const payload = Object.keys(data).map((year) =>
        Object.keys(data[year]).map((dept) =>
          Object.keys(data[year][dept]).map((course) => ({
            year: parseInt(year),
            department: dept,
            course,
            co: calculateCO(data[year][dept][course]),
            students: data[year][dept][course], // Send student data for storage
          }))
        )
      ).flat(2);

      const response = await axios.post(
        "https://your-render-backend-url.onrender.com/api/predict",
        { data: payload },
        { headers: { "Content-Type": "application/json" } }
      );
      setPredictedData(response.data.predictions);
    } catch (error) {
      console.error("Error uploading and predicting:", error);
    }
  };

  const getChartDataByYear = () => {
    const labels = Object.keys(historicalData);
    const currentData = labels.map((year) => {
      const allStudents = Object.values(historicalData[year])
        .flatMap((dept) => Object.values(dept).flat());
      return calculateCO(allStudents);
    });
    const nextYear = labels.length > 0 ? `${Math.max(...labels.map(Number)) + 1}` : "N/A";
    const predictedCO = predictedData[nextYear] || null;

    return {
      labels: [...labels, nextYear],
      datasets: [
        { label: "Current CO (%)", data: [...currentData, null], backgroundColor: "rgba(40, 167, 69, 0.6)" },
        { label: "Predicted CO (%)", data: [...currentData.map(() => null), predictedCO], backgroundColor: "rgba(255, 99, 132, 0.6)" },
      ],
    };
  };

  const getChartDataByDepartment = () => {
    const departments = [...new Set(Object.values(historicalData).flatMap((year) => Object.keys(year)))];
    const currentData = departments.map((dept) => {
      const allStudents = Object.values(historicalData)
        .flatMap((year) => Object.values(year[dept] || {}).flat());
      return calculateCO(allStudents);
    });
    const predictedCOs = departments.map((dept) => predictedData[dept] || null);

    return {
      labels: departments,
      datasets: [
        { label: "Current CO (%)", data: currentData, backgroundColor: "rgba(40, 167, 69, 0.6)" },
        { label: "Predicted CO (%)", data: predictedCOs, backgroundColor: "rgba(255, 99, 132, 0.6)" },
      ],
    };
  };

  const getChartDataByCourse = () => {
    const courses = [...new Set(Object.values(historicalData).flatMap((year) => 
      Object.values(year).flatMap((dept) => Object.keys(dept))))];
    const currentData = courses.map((course) => {
      const allStudents = Object.values(historicalData)
        .flatMap((year) => Object.values(year).flatMap((dept) => dept[course] || []));
      return calculateCO(allStudents);
    });
    const predictedCOs = courses.map((course) => predictedData[course] || null);

    return {
      labels: courses,
      datasets: [
        { label: "Current CO (%)", data: currentData, backgroundColor: "rgba(40, 167, 69, 0.6)" },
        { label: "Predicted CO (%)", data: predictedCOs, backgroundColor: "rgba(255, 99, 132, 0.6)" },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: `CO Performance by ${selectedView.charAt(0).toUpperCase() + selectedView.slice(1)}` },
    },
    scales: {
      x: { ticks: { autoSkip: true, maxRotation: 45, minRotation: 0 } },
      y: { beginAtZero: true, max: 100 },
    },
  };

  return (
    <div className="university-performance-container">
      <div className="header">
        <h2>University Performance</h2>
        <button onClick={() => navigate("/dashboard")} className="nav-btn">Back to Dashboard</button>
      </div>
      <div className="upload-section">
        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />
        <p>Upload Excel file (Columns: Year, Department, Course, RegNo, Grade, Mark)</p>
      </div>
      {Object.keys(historicalData).length > 0 && (
        <div className="results-section">
          <div className="view-toggle">
            <button onClick={() => setSelectedView("year")}>By Year</button>
            <button onClick={() => setSelectedView("department")}>By Department</button>
            <button onClick={() => setSelectedView("course")}>By Course</button>
          </div>
          <h3>Historical Data and Predictions</h3>
          <div className="chart-container">
            {selectedView === "year" && <Bar data={getChartDataByYear()} options={chartOptions} />}
            {selectedView === "department" && <Bar data={getChartDataByDepartment()} options={chartOptions} />}
            {selectedView === "course" && <Bar data={getChartDataByCourse()} options={chartOptions} />}
          </div>
        </div>
      )}
    </div>
  );
};

export default UniversityPerformance;