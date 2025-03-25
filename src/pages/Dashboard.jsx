import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaMoon, FaSun, FaFileExcel, FaFilePdf, FaPlus, FaTimes, FaTrash, FaEye, FaFileImport, FaSyncAlt } from "react-icons/fa";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import "./Dashboard.css";
import "./StudentCard.css";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Error Boundary Component
class ChartErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return <p>Failed to render chart: {this.state.error?.message || "Unknown error"}</p>;
    }
    return this.props.children;
  }
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [flippedCards, setFlippedCards] = useState({});
  const [showDetails, setShowDetails] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState("add");
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    department: "",
    year: new Date().getFullYear().toString(),
    internalMarks: "",
    examMarks: "",
    totalInternal: "",
    totalExam: "",
    coMapping: [{ coId: "CO1", internal: "", exam: "", totalInternal: "", totalExam: "" }],
    coTargets: [{ coId: "CO1", target: "70" }],
  });
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [coData, setCoData] = useState({});
  const [coLoading, setCoLoading] = useState({});
  const [filter, setFilter] = useState({ studentId: "", course: "", department: "" });
  const [loading, setLoading] = useState(false);
  const [renderKey, setRenderKey] = useState(0);
  const [isAddStudentFlipped, setIsAddStudentFlipped] = useState(false);

  const baseUrl = process.env.NODE_ENV === "development"
    ? "http://localhost:5000/api"
    : "https://student-performance-tracker-backend.onrender.com/api";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Unauthorized! Please log in first.");
      navigate("/login");
    } else {
      fetchStudents();
    }
  }, [navigate]);

  const fetchStudents = async (retryCount = 0) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("No token found! Please log in again.");
        navigate("/login");
        return;
      }

      const response = await axios.get(`${baseUrl}/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const validStudents = response.data.filter(student => {
        const isValid = student.student_id && typeof student.student_id === "string" && student.student_id.trim() !== "";
        if (!isValid) {
          console.warn("Invalid student data:", student);
        }
        return isValid;
      });

      setStudents(validStudents);

      for (const student of validStudents) {
        if (student.student_id) {
          await fetchCoData(student.student_id);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      if (error.response?.status === 401) {
        alert("Session expired! Please log in again.");
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }
      if (retryCount < 2) {
        setTimeout(() => fetchStudents(retryCount + 1), 1000);
      } else {
        alert(error.response?.data?.error || "Failed to fetch students after retries.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCoData = async (studentId, retryCount = 0) => {
    if (!studentId || typeof studentId !== "string" || studentId.trim() === "") {
      setCoData((prev) => ({ ...prev, [studentId]: { coSummary: [], error: "Invalid student ID" } }));
      setCoLoading((prev) => ({ ...prev, [studentId]: false }));
      return;
    }
    setCoLoading((prev) => ({ ...prev, [studentId]: true }));
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No token found");
      }
      const response = await axios.get(`${baseUrl}/students/calculate-co-po/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCoData((prev) => ({ ...prev, [studentId]: response.data }));
    } catch (error) {
      console.error(`Error fetching CO data for student ${studentId}:`, error);
      console.error("Response:", error.response?.data);
      setCoData((prev) => ({
        ...prev,
        [studentId]: { coSummary: [], error: error.message || "Failed to fetch CO data" },
      }));
      if (retryCount < 2) {
        setTimeout(() => fetchCoData(studentId, retryCount + 1), 1000);
      }
    } finally {
      setCoLoading((prev) => ({ ...prev, [studentId]: false }));
    }
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
    document.body.classList.toggle("dark-mode");
  };

  const exportToExcel = async () => {
    setLoading(true);
    try {
      for (const student of students) {
        if (!coData[student.student_id] && student.student_id) {
          await fetchCoData(student.student_id);
        }
      }

      const groupedByDept = students.reduce((acc, student) => {
        acc[student.department] = acc[student.department] || [];
        acc[student.department].push(student);
        return acc;
      }, {});
      const wb = XLSX.utils.book_new();
      Object.entries(groupedByDept).forEach(([dept, deptStudents]) => {
        const ws = XLSX.utils.json_to_sheet(
          deptStudents.map((student) => ({
            studentId: student.student_id,
            name: student.name,
            department: student.department,
            average: student.average || "N/A",
            coAttainment: coData[student.student_id]?.coSummary
              ?.map((co) => `${co.coId}: ${co.avgAttainment.toFixed(2)}% (Level ${assignCOLevel(co.avgAttainment)})`)
              .join(", ") || "N/A",
          }))
        );
        XLSX.utils.book_append_sheet(wb, ws, dept.slice(0, 31));
      });
      XLSX.writeFile(wb, "StudentPerformance.xlsx");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Failed to export to Excel.");
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    try {
      if (!students.length) {
        alert("No student data available to export.");
        return;
      }
      setLoading(true);
      for (const student of students) {
        if (!coData[student.student_id] && student.student_id) {
          await fetchCoData(student.student_id);
        }
      }

      const doc = new jsPDF();
      doc.text("Student Performance Report", 10, 10);
      const groupedByDept = students.reduce((acc, student) => {
        acc[student.department] = acc[student.department] || [];
        acc[student.department].push(student);
        return acc;
      }, {});
      let yOffset = 20;
      Object.entries(groupedByDept).forEach(([dept, deptStudents]) => {
        doc.text(`Department: ${dept}`, 10, yOffset);
        yOffset += 10;
        const head = [["studentId", "name", "department", "average", "coAttainment"]];
        const body = deptStudents.map((student) => [
          student.student_id,
          student.name,
          student.department,
          student.average || "N/A",
          coData[student.student_id]?.coSummary
            ?.map((co) => `${co.coId}: ${co.avgAttainment.toFixed(2)}% (Level ${assignCOLevel(co.avgAttainment)})`)
            .join(", ") || "N/A",
        ]);
        autoTable(doc, { head, body, startY: yOffset });
        yOffset = doc.lastAutoTable.finalY + 10;
      });
      doc.save("StudentPerformance.pdf");
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(`Failed to generate PDF: ${error.message}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (e, studentId) => {
    if (e.target.closest(".add-marks-btn") || e.target.closest(".delete-btn") || e.target.closest(".details-btn")) return;
    if (!studentId || typeof studentId !== "string" || studentId.trim() === "") {
      console.warn("Cannot fetch CO data: studentId is invalid", studentId);
      return;
    }
    setFlippedCards((prev) => {
      const newFlippedState = { ...prev, [studentId]: !prev[studentId] };
      setRenderKey((prev) => prev + 1);
      return newFlippedState;
    });
    fetchCoData(studentId);
  };

  const toggleDetails = (studentId) => {
    if (!studentId) return;
    setShowDetails((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  const openAddStudentModal = (e) => {
    e.stopPropagation();
    setModalType("add");
    setFormData({
      id: "",
      name: "",
      department: "",
      year: new Date().getFullYear().toString(),
      internalMarks: "",
      examMarks: "",
      totalInternal: "",
      totalExam: "",
      coMapping: [{ coId: "CO1", internal: "", exam: "", totalInternal: "", totalExam: "" }],
      coTargets: [{ coId: "CO1", target: "70" }],
    });
    setEditingStudentId(null);
    setIsModalOpen(true);
  };

  const openUpdateMarksModal = (student, e) => {
    e.stopPropagation();
    setModalType("update");
    setFormData({
      id: student.student_id,
      name: student.name,
      department: student.department,
      year: new Date().getFullYear().toString(),
      internalMarks: "",
      examMarks: "",
      totalInternal: "",
      totalExam: "",
      coMapping: student.Marks?.[0]?.MarksCoMappings?.map(co => ({
        coId: co.coId,
        internal: co.internal || "",
        exam: co.exam || "",
        totalInternal: co.totalInternal || "",
        totalExam: co.totalExam || "",
      })) || [{ coId: "CO1", internal: "", exam: "", totalInternal: "", totalExam: "" }],
      coTargets: student.CourseOutcomes?.map(co => ({
        coId: co.coId,
        target: co.target || "70",
      })) || [{ coId: "CO1", target: "70" }],
    });
    setEditingStudentId(student.student_id);
    setIsModalOpen(true);
  };

  const handleDelete = async (studentId, e) => {
    e.stopPropagation();
    if (!studentId) return;
    if (!window.confirm("Are you sure you want to delete this student?")) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No token found");
      }
      await axios.delete(`${baseUrl}/students/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents(students.filter((student) => student.student_id !== studentId));
      alert("Student deleted successfully!");
    } catch (error) {
      console.error("Error deleting student:", error);
      if (error.response?.status === 401) {
        alert("Session expired! Please log in again.");
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }
      alert(error.response?.data?.error || "Failed to delete student.");
    }
  };

  const handleInputChange = (e, index = null, field = null) => {
    if (index !== null && field && field !== "target") {
      const updatedMapping = [...formData.coMapping];
      updatedMapping[index][field] = e.target.value;
      setFormData({ ...formData, coMapping: updatedMapping });
    } else if (index !== null && field === "target") {
      const updatedTargets = [...formData.coTargets];
      updatedTargets[index].target = e.target.value;
      setFormData({ ...formData, coTargets: updatedTargets });
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const addCoMapping = () => {
    const newCoId = `CO${formData.coMapping.length + 1}`;
    setFormData({
      ...formData,
      coMapping: [
        ...formData.coMapping,
        { coId: newCoId, internal: "", exam: "", totalInternal: "", totalExam: "" },
      ],
      coTargets: [
        ...formData.coTargets,
        { coId: newCoId, target: "70" },
      ],
    });
  };

  const assignCOLevel = (attainment) => {
    if (attainment > 80) return 3;
    if (attainment > 60) return 2;
    return 1;
  };

  const adjustTargetsAutomatically = (currentTargets, coSummary) => {
    return currentTargets.map((target) => {
      const attainment = coSummary?.find((co) => co.coId === target.coId)?.avgAttainment || 0;
      const nextYearTarget = attainment > target.target + 10 ? Math.min(target.target + 5, 100) : target.target;
      return { ...target, target: nextYearTarget };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Session expired! Please log in again.");
      localStorage.removeItem("token");
      navigate("/login");
      return;
    }
    try {
      setLoading(true);
      if (modalType === "add") {
        const newStudent = {
          studentId: formData.id,
          name: formData.name,
          department: formData.department,
          marks: [
            {
              year: formData.year,
              internal: parseFloat(formData.internalMarks) || 0,
              exam: parseFloat(formData.examMarks) || 0,
              totalInternal: parseFloat(formData.totalInternal) || 0,
              totalExam: parseFloat(formData.totalExam) || 0,
              coMapping: formData.coMapping.map((co) => ({
                coId: co.coId,
                internal: parseFloat(co.internal) || 0,
                exam: parseFloat(co.exam) || 0,
                totalInternal: parseFloat(co.totalInternal) || 0,
                totalExam: parseFloat(co.totalExam) || 0,
              })),
            },
          ],
          courseOutcomes: formData.coTargets.map((target) => ({
            coId: target.coId,
            target: parseFloat(target.target) || 70,
          })),
        };
        console.log("Adding new student payload:", newStudent);
        await axios.post(`${baseUrl}/students`, newStudent, {
          headers: { Authorization: `Bearer ${token}` },
        });
        alert("Student added successfully!");
      } else if (modalType === "update") {
        // Validate required fields
        if (!formData.year || !formData.internalMarks || !formData.examMarks || !formData.totalInternal || !formData.totalExam) {
          alert("Please fill in all required fields (year, internal marks, exam marks, total internal, total exam).");
          setLoading(false);
          return;
        }
  
        // Prepare the new marks entry
        const newMarksEntry = {
          year: formData.year,
          internal: parseFloat(formData.internalMarks) || 0,
          exam: parseFloat(formData.examMarks) || 0,
          totalInternal: parseFloat(formData.totalInternal) || 0,
          totalExam: parseFloat(formData.totalExam) || 0,
          coMapping: formData.coMapping.map((co) => ({
            coId: co.coId,
            internal: parseFloat(co.internal) || 0,
            exam: parseFloat(co.exam) || 0,
            totalInternal: parseFloat(co.totalInternal) || 0,
            totalExam: parseFloat(co.totalExam) || 0,
          })),
        };
  
        // Update the student with the new marks
        const marksUpdatePayload = {
          marks: [newMarksEntry], // Send as an array since the backend expects an array
        };
        console.log("Updating marks payload:", marksUpdatePayload);
        const marksResponse = await axios.put(
          `${baseUrl}/students/${editingStudentId}`,
          marksUpdatePayload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
  
        // Update CO/PO data and adjust targets
        const updatedCoData = await axios.get(`${baseUrl}/students/calculate-co-po/${editingStudentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const adjustedTargets = adjustTargetsAutomatically(formData.coTargets, updatedCoData.data.coSummary);
  
        // Update course outcomes separately
        const courseOutcomesPayload = {
          courseOutcomes: adjustedTargets.map((target) => ({
            coId: target.coId,
            target: parseFloat(target.target) || 70,
          })),
        };
        console.log("Updating course outcomes payload:", courseOutcomesPayload);
        await axios.put(
          `${baseUrl}/students/${editingStudentId}/course-outcomes`,
          courseOutcomesPayload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
  
        alert("Marks updated and targets adjusted successfully!");
      }
      setIsModalOpen(false);
      fetchStudents();
    } catch (error) {
      console.error("Error submitting form:", error);
      console.error("Response:", error.response?.data);
      if (error.response?.status === 401) {
        alert("Session expired! Please log in again.");
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }
      alert(error.response?.data?.error || "Failed to save data.");
    } finally {
      setLoading(false);
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
  
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No token found");
      }
  
      const reader = new FileReader();
      reader.onload = async (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
  
        const studentsToAdd = jsonData.map((row) => {
          const coMapping = [];
          const coTargets = [];
          let coIndex = 1;
  
          // Parse CO data dynamically (e.g., co1, co2, co3, ...)
          while (row[`co${coIndex} internal marks`] !== undefined) {
            const coId = `CO${coIndex}`;
            coMapping.push({
              coId,
              internal: parseFloat(row[`co${coIndex} internal marks`]) || 0,
              exam: parseFloat(row[`co${coIndex} exam marks`]) || 0,
              totalInternal: parseFloat(row[`co${coIndex} internal total`]) || 0,
              totalExam: parseFloat(row[`co${coIndex} exam total`]) || 0,
            });
            coTargets.push({
              coId,
              target: parseFloat(row[`co${coIndex} target %`]) || 70,
            });
            coIndex++;
          }
  
          return {
            studentId: row["student id"]?.toString(),
            name: row["student name"],
            department: row["department"],
            marks: [
              {
                year: row["year"]?.toString() || new Date().getFullYear().toString(),
                internal: parseFloat(row["internal marks"]) || 0,
                exam: parseFloat(row["exam marks"]) || 0,
                totalInternal: parseFloat(row["total internal marks"]) || 0,
                totalExam: parseFloat(row["total exam marks"]) || 0,
                coMapping: coMapping.length > 0 ? coMapping : [{ coId: "CO1", internal: 0, exam: 0, totalInternal: 0, totalExam: 0 }],
              },
            ],
            courseOutcomes: coTargets.length > 0 ? coTargets : [{ coId: "CO1", target: 70 }],
          };
        });
  
        // Validate and filter out invalid entries
        const validStudents = studentsToAdd.filter(student => {
          if (!student.studentId || !student.name || !student.department) {
            console.warn("Skipping invalid student entry:", student);
            return false;
          }
          return true;
        });
  
        if (validStudents.length === 0) {
          alert("No valid student data found in the Excel file.");
          setLoading(false);
          return;
        }
  
        // Send each student to the backend
        for (const student of validStudents) {
          console.log("Importing student payload:", student);
          await axios.post(`${baseUrl}/students`, student, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
  
        alert("Students imported successfully!");
        fetchStudents();
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error importing Excel:", error);
      if (error.response?.status === 401) {
        alert("Session expired! Please log in again.");
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }
      alert(error.response?.data?.error || "Failed to import students.");
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(
    (student) =>
      (!filter.studentId || student.student_id.includes(filter.studentId)) &&
      (!filter.course || student.name.toLowerCase().includes(filter.course.toLowerCase())) &&
      (!filter.department || student.department.toLowerCase().includes(filter.department.toLowerCase()))
  );

  const historicalChartData = (student) => {
    const marks = student?.Marks || [];
    if (!marks || marks.length === 0) {
      return {
        labels: ["No Data"],
        datasets: [
          {
            label: "Internal (%)",
            data: [0],
            backgroundColor: "rgba(40, 167, 69, 0.6)",
            borderColor: "rgba(40, 167, 69, 1)",
            borderWidth: 1,
            barThickness: 20,
          },
          {
            label: "Exam (%)",
            data: [0],
            backgroundColor: "rgba(255, 99, 132, 0.6)",
            borderColor: "rgba(255, 99, 132, 1)",
            borderWidth: 1,
            barThickness: 20,
          },
        ],
      };
    }

    const labels = marks.map((m, index) => m.year || `Entry ${index + 1}`);
    const internalData = marks.map((m) => (m.internal / (m.totalInternal || 1)) * 100);
    const examData = marks.map((m) => (m.exam / (m.totalExam || 1)) * 100);

    return {
      labels,
      datasets: [
        {
          label: "Internal (%)",
          data: internalData,
          backgroundColor: "rgba(40, 167, 69, 0.6)",
          borderColor: "rgba(40, 167, 69, 1)",
          borderWidth: 1,
          barThickness: 20,
        },
        {
          label: "Exam (%)",
          data: examData,
          backgroundColor: "rgba(255, 99, 132, 0.6)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 1,
          barThickness: 20,
        },
      ],
    };
  };

  const coChartData = (studentId) => {
    const data = coData[studentId];
    if (!data || !data.coSummary || data.coSummary.length === 0) {
      return {
        labels: ["No Data"],
        datasets: [
          {
            label: "Attainment (%)",
            data: [0],
            backgroundColor: "rgba(54, 162, 235, 0.6)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1,
            barThickness: 20,
          },
        ],
      };
    }

    return {
      labels: data.coSummary.map((co) => co.coId),
      datasets: [
        {
          label: "Attainment (%)",
          data: data.coSummary.map((co) => co.avgAttainment),
          backgroundColor: "rgba(54, 162, 235, 0.6)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 1,
          barThickness: 20,
        },
        {
          label: "Target (%)",
          data: data.coSummary.map((co) => co.target),
          backgroundColor: "rgba(255, 206, 86, 0.6)",
          borderColor: "rgba(255, 206, 86, 1)",
          borderWidth: 1,
          barThickness: 20,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: "Performance Overview" },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: { display: true, text: "Percentage (%)" },
      },
    },
  };

  return (
    <div className={`dashboard ${darkMode ? "dark-mode" : ""}`}>
      <header className="dashboard-header">
        <h1>Student Performance Tracker</h1>
        <div className="header-actions">
          <button onClick={toggleDarkMode} className="theme-toggle">
            {darkMode ? <FaSun /> : <FaMoon />}
          </button>
          <button onClick={exportToExcel} disabled={loading}>
            <FaFileExcel /> Export to Excel
          </button>
          <button onClick={exportToPDF} disabled={loading}>
            <FaFilePdf /> Export to PDF
          </button>
          <label className="import-btn">
            <FaFileImport /> Import Excel
            <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} hidden />
          </label>
          <button onClick={fetchStudents} disabled={loading}>
            <FaSyncAlt /> Refresh
          </button>
        </div>
      </header>

      <div className="filters">
        <input
          type="text"
          placeholder="Filter by Student ID"
          value={filter.studentId}
          onChange={(e) => setFilter({ ...filter, studentId: e.target.value })}
        />
        <input
          type="text"
          placeholder="Filter by Course"
          value={filter.course}
          onChange={(e) => setFilter({ ...filter, course: e.target.value })}
        />
        <input
          type="text"
          placeholder="Filter by Department"
          value={filter.department}
          onChange={(e) => setFilter({ ...filter, department: e.target.value })}
        />
      </div>

      <div className="student-grid">
        <div className="student-card add-student-card" onClick={openAddStudentModal}>
          <div className="card-front">
            <h3>Add Student</h3>
            <FaPlus className="add-icon" />
          </div>
        </div>

        {filteredStudents.map((student) => (
          <div
            key={student.student_id}
            className={`student-card ${flippedCards[student.student_id] ? "flipped" : ""}`}
            onClick={(e) => handleCardClick(e, student.student_id)}
          >
            <div className="card-front">
              <h3>{student.name}</h3>
              <p>ID: {student.student_id}</p>
              <p>Department: {student.department}</p>
              <p>Average: {student.average || "N/A"}%</p>
              <div className="card-actions">
                <button className="add-marks-btn" onClick={(e) => openUpdateMarksModal(student, e)}>
                  Add Marks
                </button>
                <button className="delete-btn" onClick={(e) => handleDelete(student.student_id, e)}>
                  <FaTrash />
                </button>
                <button className="details-btn" onClick={() => toggleDetails(student.student_id)}>
                  <FaEye />
                </button>
              </div>
            </div>
            <div className="card-back">
              {coLoading[student.student_id] ? (
                <p>Loading CO/PO data...</p>
              ) : coData[student.student_id]?.error ? (
                <p>Error: {coData[student.student_id].error}</p>
              ) : (
                <>
                  <h4>CO Attainment</h4>
                  <ChartErrorBoundary>
                    <div className="chart-container">
                      <Bar data={coChartData(student.student_id)} options={chartOptions} />
                    </div>
                  </ChartErrorBoundary>
                  {showDetails[student.student_id] && (
                    <>
                      <h4>Historical Performance</h4>
                      <ChartErrorBoundary>
                        <div className="chart-container">
                          <Bar data={historicalChartData(student)} options={chartOptions} />
                        </div>
                      </ChartErrorBoundary>
                      <h4>PO Attainment</h4>
                      <ul>
                        {coData[student.student_id]?.poSummary?.map((po, index) => (
                          <li key={index}>
                            {po.poId}: {po.avgAttainment.toFixed(2)}%
                          </li>
                        )) || <li>No PO data available</li>}
                      </ul>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h2>{modalType === "add" ? "Add Student" : "Update Marks"}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Student ID</label>
                <input
                  type="text"
                  name="id"
                  value={formData.id}
                  onChange={handleInputChange}
                  disabled={modalType === "update"}
                  required
                />
              </div>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={modalType === "update"}
                  required
                />
              </div>
              <div className="form-group">
                <label>Department</label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  disabled={modalType === "update"}
                  required
                />
              </div>
              <div className="form-group">
                <label>Year</label>
                <input
                  type="text"
                  name="year"
                  value={formData.year}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Internal Marks</label>
                <input
                  type="number"
                  name="internalMarks"
                  value={formData.internalMarks}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Total Internal Marks</label>
                <input
                  type="number"
                  name="totalInternal"
                  value={formData.totalInternal}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Exam Marks</label>
                <input
                  type="number"
                  name="examMarks"
                  value={formData.examMarks}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Total Exam Marks</label>
                <input
                  type="number"
                  name="totalExam"
                  value={formData.totalExam}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <h4>CO Mapping</h4>
              {formData.coMapping.map((co, index) => (
                <div key={index} className="co-mapping">
                  <div className="form-group">
                    <label>CO ID</label>
                    <input type="text" value={co.coId} disabled />
                  </div>
                  <div className="form-group">
                    <label>Internal Marks</label>
                    <input
                      type="number"
                      value={co.internal}
                      onChange={(e) => handleInputChange(e, index, "internal")}
                    />
                  </div>
                  <div className="form-group">
                    <label>Total Internal</label>
                    <input
                      type="number"
                      value={co.totalInternal}
                      onChange={(e) => handleInputChange(e, index, "totalInternal")}
                    />
                  </div>
                  <div className="form-group">
                    <label>Exam Marks</label>
                    <input
                      type="number"
                      value={co.exam}
                      onChange={(e) => handleInputChange(e, index, "exam")}
                    />
                  </div>
                  <div className="form-group">
                    <label>Total Exam</label>
                    <input
                      type="number"
                      value={co.totalExam}
                      onChange={(e) => handleInputChange(e, index, "totalExam")}
                    />
                  </div>
                  <div className="form-group">
                    <label>Target (%)</label>
                    <input
                      type="number"
                      value={formData.coTargets[index]?.target || ""}
                      onChange={(e) => handleInputChange(e, index, "target")}
                    />
                  </div>
                </div>
              ))}
              <button type="button" onClick={addCoMapping}>
                Add CO Mapping
              </button>
              <div className="modal-actions">
                <button type="submit" disabled={loading}>
                  {modalType === "add" ? "Add Student" : "Update Marks"}
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={loading}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;