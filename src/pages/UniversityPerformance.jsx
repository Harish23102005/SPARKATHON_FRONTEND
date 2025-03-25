import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import "./UniversityPerformance.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const UniversityPerformance = () => {
  const navigate = useNavigate();
  const [historicalData, setHistoricalData] = useState({}); // { year: { dept: { course: [students] } } }
  const [selectedView, setSelectedView] = useState("year"); // Toggle between year, dept, course

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const binaryStr = event.target.result;
      const workbook = XLSX.read(binaryStr, { type: "binary" });

      // Process all sheets in the workbook
      const allSheetData = {};
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const parsedData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const sheetData = processExcelData(parsedData);
        updateHistoricalData(sheetData, allSheetData);
      });

      // Replace the historicalData with the new file's data
      setHistoricalData(allSheetData);
    };
    reader.readAsBinaryString(file);
  };

  const processExcelData = (rawData) => {
    const year = rawData[0][0]; // e.g., 2022
    const department = rawData[1][0]; // e.g., CSE
    const course = rawData[2][0]; // e.g., Prog101
    const studentData = rawData.slice(4); // Skip headers (Reg No, Grade, Mark)

    return {
      year,
      department,
      course,
      students: studentData.map((row) => ({
        regno: row[0],
        grade: row[1],
        mark: row[2],
      })),
    };
  };

  const updateHistoricalData = (newData, allSheetData) => {
    const { year, department, course, students } = newData;

    if (!allSheetData[year]) allSheetData[year] = {};
    if (!allSheetData[year][department]) allSheetData[year][department] = {};
    allSheetData[year][department][course] = students;
  };

  const calculateCO = (students) => {
    const totalMarks = students.reduce((sum, student) => sum + (student.mark || 0), 0);
    const totalStudents = students.length;
    return totalStudents > 0 ? (totalMarks / totalStudents).toFixed(2) : 0;
  };

  const predictFutureCO = (currentCO) => {
    // Simple prediction: 5% growth, capped at 100
    return Math.min(parseFloat(currentCO) * 1.05, 100).toFixed(2);
  };

  const getChartDataByYear = () => {
    const labels = Object.keys(historicalData);
    const currentData = labels.map((year) => {
      const allStudents = Object.values(historicalData[year])
        .flatMap((dept) => Object.values(dept).flat());
      return calculateCO(allStudents);
    });
    const predictedData = currentData.map((co) => predictFutureCO(co));
    const nextYear = labels.length > 0 ? `${Math.max(...labels.map(Number)) + 1}` : "N/A";

    return {
      labels: [...labels, nextYear],
      datasets: [
        {
          label: "Current CO (%)",
          data: [...currentData, null],
          backgroundColor: "rgba(40, 167, 69, 0.6)",
        },
        {
          label: "Predicted CO (%)",
          data: [...currentData.map(() => null), predictedData[predictedData.length - 1] || null],
          backgroundColor: "rgba(255, 99, 132, 0.6)",
        },
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
    const predictedData = currentData.map((co) => predictFutureCO(co));

    return {
      labels: departments,
      datasets: [
        {
          label: "Current CO (%)",
          data: currentData,
          backgroundColor: "rgba(40, 167, 69, 0.6)",
        },
        {
          label: "Predicted CO (%)",
          data: predictedData,
          backgroundColor: "rgba(255, 99, 132, 0.6)",
        },
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
    const predictedData = currentData.map((co) => predictFutureCO(co));

    return {
      labels: courses,
      datasets: [
        {
          label: "Current CO (%)",
          data: currentData,
          backgroundColor: "rgba(40, 167, 69, 0.6)",
        },
        {
          label: "Predicted CO (%)",
          data: predictedData,
          backgroundColor: "rgba(255, 99, 132, 0.6)",
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false, // Allow the chart to fill the container without maintaining aspect ratio
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: `CO Performance by ${selectedView.charAt(0).toUpperCase() + selectedView.slice(1)}` },
    },
    scales: {
      x: {
        ticks: {
          autoSkip: true, // Automatically skip labels to prevent overcrowding
          maxRotation: 45, // Rotate labels if needed
          minRotation: 0,
        },
      },
      y: {
        beginAtZero: true,
        max: 100, // Cap the y-axis at 100%
      },
    },
  };

  return (
    <div className="university-performance-container">
      <div className="header">
        <h2>University Performance</h2>
        <button onClick={() => navigate("/dashboard")} className="nav-btn">
          Back to Dashboard
        </button>
      </div>
      <div className="upload-section">
        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />
        <p>Upload Excel file (Each sheet: Row 1: Year, Row 2: Dept, Row 3: Course, Rows 5+: Regno, Grade, Mark)</p>
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
            {selectedView === "year" && (
              <Bar data={getChartDataByYear()} options={chartOptions} />
            )}
            {selectedView === "department" && (
              <Bar data={getChartDataByDepartment()} options={chartOptions} />
            )}
            {selectedView === "course" && (
              <Bar data={getChartDataByCourse()} options={chartOptions} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UniversityPerformance;