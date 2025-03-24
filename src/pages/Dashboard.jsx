import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaMoon, FaSun, FaFileExcel, FaFilePdf, FaPlus, FaTimes, FaTrash, FaEye } from "react-icons/fa";
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

// Custom hook to force chart re-rendering
const useChartRender = (isFlipped) => {
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    if (isFlipped) {
      // Delay the re-render to ensure the DOM is ready after the flip animation
      const timer = setTimeout(() => {
        setRenderKey((prev) => prev + 1);
      }, 600); // Match the flip animation duration (0.6s)
      return () => clearTimeout(timer);
    }
  }, [isFlipped]);

  return renderKey;
};

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

  // Define base URL consistently
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

      // Stricter validation for student_id
      const validStudents = response.data.filter(student => {
        const isValid = student.student_id && typeof student.student_id === "string" && student.student_id.trim() !== "";
        if (!isValid) {
          console.warn("Invalid student data:", student);
        }
        return isValid;
      });
      console.log("Fetched students:", validStudents);

      // Calculate average for each student if not provided
      const studentsWithAverage = validStudents.map(student => ({
        ...student,
        average: student.average || calculateStudentAverage(student),
      }));
      setStudents(studentsWithAverage);

      // Fetch CO data for each student
      for (const student of studentsWithAverage) {
        if (student.student_id) {
          await fetchCoData(student.student_id);
          await new Promise(resolve => setTimeout(resolve, 100)); // Throttle requests
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
        console.log(`Retrying fetchStudents (attempt ${retryCount + 1})...`);
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
      console.warn("Skipping CO fetch: studentId is invalid", studentId);
      setCoData((prev) => ({ ...prev, [studentId]: { coSummary: [] } }));
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
      console.log(`CO data for student ${studentId}:`, response.data);
    } catch (error) {
      console.error(`Error fetching CO data for student ${studentId}:`, error);
      if (error.response?.status === 401) {
        alert("Session expired! Please log in again.");
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }
      setCoData((prev) => ({ ...prev, [studentId]: { coSummary: [] } }));
      if (retryCount < 2) {
        console.log(`Retrying fetchCoData for student ${studentId} (attempt ${retryCount + 1})...`);
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
            average: student.average,
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
          student.average,
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
    setFlippedCards((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
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
        console.log("Submitting new student:", newStudent);
        await axios.post(`${baseUrl}/students`, newStudent, {
          headers: { Authorization: `Bearer ${token}` },
        });
        alert("Student added successfully!");
      } else if (modalType === "update") {
        const updatedMarks = {
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
        };
        await axios.put(
          `${baseUrl}/students/${editingStudentId}`,
          updatedMarks,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const updatedCoData = await axios.get(`${baseUrl}/students/calculate-co-po/${editingStudentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const adjustedTargets = adjustTargetsAutomatically(formData.coTargets, updatedCoData.data.coSummary);
        await axios.put(
          `${baseUrl}/students/${editingStudentId}`,
          {
            courseOutcomes: adjustedTargets.map((target) => ({
              coId: target.coId,
              target: parseFloat(target.target) || 70,
            })),
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert("Marks updated and targets adjusted successfully!");
      }
      setIsModalOpen(false);
      fetchStudents();
    } catch (error) {
      console.error("Error submitting form:", error);
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

  const calculateStudentAverage = (student) => {
    if (!student.Marks || student.Marks.length === 0) {
      return "N/A";
    }

    const totalMarks = student.Marks.reduce((sum, mark) => {
      const internalPercentage = (mark.internal / (mark.totalInternal || 1)) * 100;
      const examPercentage = (mark.exam / (mark.totalExam || 1)) * 100;
      return sum + (internalPercentage + examPercentage) / 2;
    }, 0);

    const average = totalMarks / student.Marks.length;
    return average.toFixed(2);
  };

  const filteredStudents = students.filter(
    (student) =>
      (!filter.studentId || student.student_id.includes(filter.studentId)) &&
      (!filter.course || student.name.toLowerCase().includes(filter.course.toLowerCase())) &&
      (!filter.department || student.department.toLowerCase().includes(filter.department.toLowerCase()))
  );

  const coChartData = (studentId) => {
    const data = coData[studentId] || { coSummary: [] };
    const coSummary = Array.isArray(data.coSummary) ? data.coSummary : [];
    console.log(`CO Chart Data for student ${studentId}:`, coSummary);
    if (!coSummary || coSummary.length === 0) {
      return {
        labels: ["No Data"],
        datasets: [
          {
            label: "Attainment (%)",
            data: [0],
            backgroundColor: "rgba(40, 167, 69, 0.6)",
            borderColor: "rgba(40, 167, 69, 1)",
            borderWidth: 1,
            barThickness: 20,
          },
        ],
      };
    }
    const labels = coSummary.map((co) => co.coId) || [];
    const dataValues = coSummary.map((co) => co.avgAttainment || 0) || [];
    console.log(`CO Chart Data - Labels: ${labels}, Data: ${dataValues}`);
    return {
      labels,
      datasets: [
        {
          label: "Attainment (%)",
          data: dataValues,
          backgroundColor: "rgba(40, 167, 69, 0.6)",
          borderColor: "rgba(40, 167, 69, 1)",
          borderWidth: 1,
          barThickness: 20,
        },
      ],
    };
  };

  const historicalChartData = (student) => {
    const marks = student?.Marks || [];
    console.log(`Historical Chart Data for student ${student?.student_id || 'unknown'}:`, marks);
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
    const internalData = marks.map((m) => {
      const percentage = (m.internal / (m.totalInternal || 1)) * 100;
      return isNaN(percentage) || !isFinite(percentage) ? 0 : percentage;
    });
    const examData = marks.map((m) => {
      const percentage = (m.exam / (m.totalExam || 1)) * 100;
      return isNaN(percentage) || !isFinite(percentage) ? 0 : percentage;
    });

    console.log(`Historical Chart Data - Labels: ${labels}, Internal: ${internalData}, Exam: ${examData}`);

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

  const calculateThreeYearComparison = (student) => {
    const recentMarks = student?.Marks?.slice(-3) || [];
    const avgInternal = recentMarks.reduce((sum, m) => sum + (m.internal / (m.totalInternal || 1) * 100), 0) / (recentMarks.length || 1) || 0;
    const avgExam = recentMarks.reduce((sum, m) => sum + (m.exam / (m.totalExam || 1) * 100), 0) / (recentMarks.length || 1) || 0;
    const latest = recentMarks[recentMarks.length - 1] || { internal: 0, totalInternal: 1, exam: 0, totalExam: 1 };
    const currentInternal = (latest.internal / (latest.totalInternal || 1)) * 100 || 0;
    const currentExam = (latest.exam / (latest.totalExam || 1)) * 100 || 0;
    return {
      avgInternal: avgInternal.toFixed(2),
      avgExam: avgExam.toFixed(2),
      internalAboveAvg: currentInternal > avgInternal ? "Above" : "Below",
      examAboveAvg: currentExam > avgExam ? "Above" : "Below",
    };
  };

  return (
    <div className={`dashboard-container ${darkMode ? "dark-mode" : ""}`}>
      <div className="dashboard-header">
        <h2>Student Performance Dashboard</h2>
        <div className="header-nav">
          <button onClick={() => navigate("/university-performance")} className="nav-btn">
            University Performance
          </button>
          <button onClick={() => navigate("/semester-results-upload")} className="nav-btn">
            Upload Semester Results
          </button>
          <div className="export-buttons">
            <button className="export-btn" onClick={exportToExcel} disabled={loading}>
              <FaFileExcel /> Export Excel {loading && "(Loading...)"}
            </button>
            <button className="export-btn" onClick={exportToPDF} disabled={loading}>
              <FaFilePdf /> Export PDF {loading && "(Loading...)"}
            </button>
          </div>
          <button className="theme-toggle" onClick={toggleDarkMode}>
            {darkMode ? <FaSun /> : <FaMoon />}
          </button>
        </div>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Filter by Student ID"
          value={filter.studentId}
          onChange={(e) => setFilter({ ...filter, studentId: e.target.value })}
        />
        <input
          type="text"
          placeholder="Filter by Course/Name"
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

      <div className="student-cards">
        {loading ? (
          <p>Loading students...</p>
        ) : filteredStudents.length === 0 ? (
          <p className="no-students-message">No students available. Add a new student!</p>
        ) : (
          filteredStudents.map((student, index) => {
            const threeYearComp = calculateThreeYearComparison(student);
            const isFlipped = flippedCards[student.student_id];
            const renderKey = useChartRender(isFlipped);
            return (
              <div
                key={student.student_id || index}
                className={`student-card ${isFlipped ? "flipped" : ""}`}
                onClick={(e) => handleCardClick(e, student.student_id)}
              >
                <div className="card-inner">
                  <div className="card-front">
                    <button
                      className="delete-btn"
                      onClick={(e) => handleDelete(student.student_id, e)}
                    >
                      <FaTrash />
                    </button>
                    <div className="student-info">
                      <span>
                        <strong>Student ID:</strong> {student.student_id}
                      </span>
                      <span>
                        <strong>Name:</strong> {student.name}
                      </span>
                      <span>
                        <strong>Department:</strong> {student.department}
                      </span>
                      <span>
                        <strong>Average:</strong> {student.average || "N/A"}
                      </span>
                    </div>
                    <button
                      className="add-marks-btn"
                      onClick={(e) => openUpdateMarksModal(student, e)}
                    >
                      <span className="add-marks-text">+ Add Marks</span>
                    </button>
                  </div>
                  <div className="card-back">
                    <button
                      className="details-btn"
                      onClick={() => toggleDetails(student.student_id)}
                    >
                      <FaEye /> {showDetails[student.student_id] ? "Hide Details" : "Show Details"}
                    </button>
                    {showDetails[student.student_id] && (
                      <>
                        <h3>Performance Trends</h3>
                        <div className="chart-container">
                          {student.Marks && student.Marks.length > 0 ? (
                            <ChartErrorBoundary>
                              <Bar
                                key={`historical-${student.student_id}-${renderKey}`}
                                data={historicalChartData(student)}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  layout: {
                                    padding: {
                                      left: 10,
                                      right: 10,
                                      top: 10,
                                      bottom: 10,
                                    },
                                  },
                                  plugins: {
                                    legend: {
                                      position: "top",
                                      labels: {
                                        font: {
                                          size: 10,
                                        },
                                      },
                                    },
                                    title: {
                                      display: true,
                                      text: "Historical Performance",
                                      font: {
                                        size: 14,
                                      },
                                    },
                                  },
                                  scales: {
                                    x: {
                                      ticks: {
                                        autoSkip: true,
                                        maxRotation: 0,
                                        minRotation: 0,
                                        font: {
                                          size: 10,
                                        },
                                      },
                                    },
                                    y: {
                                      beginAtZero: true,
                                      max: 100,
                                      ticks: {
                                        font: {
                                          size: 10,
                                        },
                                        stepSize: 25,
                                      },
                                    },
                                  },
                                }}
                              />
                            </ChartErrorBoundary>
                          ) : (
                            <p>No historical data available.</p>
                          )}
                        </div>
                        <h3>3-Year Comparison</h3>
                        <p>Internal Avg: {threeYearComp.avgInternal}% ({threeYearComp.internalAboveAvg})</p>
                        <p>Exam Avg: {threeYearComp.avgExam}% ({threeYearComp.examAboveAvg})</p>
                        <h3>CO/PO Attainment</h3>
                        <div className="chart-container">
                          {coLoading[student.student_id] ? (
                            <p>Loading CO data...</p>
                          ) : coData[student.student_id] && coData[student.student_id].coSummary?.length > 0 ? (
                            <ChartErrorBoundary>
                              <Bar
                                key={`co-${student.student_id}-${renderKey}`}
                                data={coChartData(student.student_id)}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  layout: {
                                    padding: {
                                      left: 10,
                                      right: 10,
                                      top: 10,
                                      bottom: 10,
                                    },
                                  },
                                  plugins: {
                                    legend: {
                                      position: "top",
                                      labels: {
                                        font: {
                                          size: 10,
                                        },
                                      },
                                    },
                                    title: {
                                      display: true,
                                      text: "CO/PO Attainment",
                                      font: {
                                        size: 14,
                                      },
                                    },
                                  },
                                  scales: {
                                    x: {
                                      ticks: {
                                        autoSkip: true,
                                        maxRotation: 0,
                                        minRotation: 0,
                                        font: {
                                          size: 10,
                                        },
                                      },
                                    },
                                    y: {
                                      beginAtZero: true,
                                      max: 100,
                                      ticks: {
                                        font: {
                                          size: 10,
                                        },
                                        stepSize: 25,
                                      },
                                    },
                                  },
                                }}
                              />
                            </ChartErrorBoundary>
                          ) : (
                            <p>No CO data available yet.</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        <button className="add-student-btn" onClick={(e) => openAddStudentModal(e)} disabled={loading}>
          <FaPlus className="plus-icon" /> Add Student
        </button>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal" key={modalType}>
            <button className="close-btn" onClick={() => setIsModalOpen(false)}>
              ❌
            </button>
            <h2>{modalType === "add" ? "Add Student" : "Add Marks"}</h2>
            <form onSubmit={handleSubmit}>
              {modalType === "add" && (
                <>
                  <input
                    type="text"
                    name="id"
                    placeholder="Student ID"
                    value={formData.id}
                    onChange={handleInputChange}
                    required
                  />
                  <input
                    type="text"
                    name="name"
                    placeholder="Student Name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                  <input
                    type="text"
                    name="department"
                    placeholder="Department"
                    value={formData.department}
                    onChange={handleInputChange}
                    required
                  />
                </>
              )}
              <input
                type="text"
                name="year"
                placeholder="Year"
                value={formData.year}
                onChange={handleInputChange}
                required
              />
              <input
                type="number"
                name="internalMarks"
                placeholder="Internal Marks"
                value={formData.internalMarks}
                onChange={handleInputChange}
                required
              />
              <input
                type="number"
                name="totalInternal"
                placeholder="Total Internal Marks"
                value={formData.totalInternal}
                onChange={handleInputChange}
                required
              />
              <input
                type="number"
                name="examMarks"
                placeholder="Exam Marks"
                value={formData.examMarks}
                onChange={handleInputChange}
                required
              />
              <input
                type="number"
                name="totalExam"
                placeholder="Total Exam Marks"
                value={formData.totalExam}
                onChange={handleInputChange}
                required
              />
              <h3>CO Mapping</h3>
              {formData.coMapping.map((co, index) => (
                <div key={index}>
                  <input
                    type="number"
                    placeholder={`CO${index + 1} Internal Marks`}
                    value={co.internal}
                    onChange={(e) => handleInputChange(e, index, "internal")}
                    required
                  />
                  <input
                    type="number"
                    placeholder={`CO${index + 1} Internal Total`}
                    value={co.totalInternal}
                    onChange={(e) => handleInputChange(e, index, "totalInternal")}
                    required
                  />
                  <input
                    type="number"
                    placeholder={`CO${index + 1} Exam Marks`}
                    value={co.exam}
                    onChange={(e) => handleInputChange(e, index, "exam")}
                    required
                  />
                  <input
                    type="number"
                    placeholder={`CO${index + 1} Exam Total`}
                    value={co.totalExam}
                    onChange={(e) => handleInputChange(e, index, "totalExam")}
                    required
                  />
                </div>
              ))}
              <button type="button" onClick={addCoMapping}>Add CO</button>
              <h3>CO Targets</h3>
              {formData.coTargets.map((co, index) => (
                <div key={index}>
                  <input
                    type="number"
                    placeholder={`CO${index + 1} Target (%)`}
                    value={co.target}
                    onChange={(e) => handleInputChange(e, index, "target")}
                    required
                  />
                </div>
              ))}
              <button type="submit" disabled={loading}>
                Save {loading && "(Saving...)"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;