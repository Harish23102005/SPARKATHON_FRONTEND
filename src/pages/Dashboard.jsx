import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaMoon, FaSun, FaFileExcel, FaFilePdf, FaPlus, FaTrash, FaEye, FaFileImport } from "react-icons/fa";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./Dashboard.css";

const Dashboard = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [filter, setFilter] = useState({ studentId: "", course: "", department: "" });
  const [loading, setLoading] = useState(false);
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

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
    document.body.classList.toggle("dark-mode");
  };

  const exportToExcel = async () => {
    setLoading(true);
    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(
        students.map((student) => ({
          studentId: student.student_id,
          name: student.name,
          department: student.department,
          average: student.average || "N/A",
        }))
      );
      XLSX.utils.book_append_sheet(wb, ws, "Students");
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
      const doc = new jsPDF();
      doc.text("Student Performance Report", 10, 10);
      const head = [["studentId", "name", "department", "average"]];
      const body = students.map((student) => [
        student.student_id,
        student.name,
        student.department,
        student.average || "N/A",
      ]);
      autoTable(doc, { head, body, startY: 20 });
      doc.save("StudentPerformance.pdf");
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(`Failed to generate PDF: ${error.message}.`);
    } finally {
      setLoading(false);
    }
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
      internalMarks: student.marks?.[0]?.internal || "",
      examMarks: student.marks?.[0]?.exam || "",
      totalInternal: student.marks?.[0]?.totalInternal || "",
      totalExam: student.marks?.[0]?.totalExam || "",
      coMapping: student.marks?.[0]?.coMapping || [{ coId: "CO1", internal: "", exam: "", totalInternal: "", totalExam: "" }],
      coTargets: student.course_outcomes || [{ coId: "CO1", target: "70" }],
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
        await axios.post(`${baseUrl}/students`, newStudent, {
          headers: { Authorization: `Bearer ${token}` },
        });
        alert("Student added successfully!");
      } else if (modalType === "update") {
        if (!formData.year || !formData.internalMarks || !formData.examMarks || !formData.totalInternal || !formData.totalExam) {
          alert("Please fill in all required fields (year, internal marks, exam marks, total internal, total exam).");
          setLoading(false);
          return;
        }

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

        const marksUpdatePayload = {
          marks: [newMarksEntry],
        };
        await axios.put(
          `${baseUrl}/students/${editingStudentId}`,
          marksUpdatePayload,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        alert("Marks updated successfully!");
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

        for (const student of validStudents) {
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

  return (
    <div className={`dashboard ${darkMode ? "dark-mode" : ""}`}>
      <header className="dashboard-header">
        <h1>Student Performance Dashboard</h1>
        <div className="header-actions">
          <label className="import-btn">
            Upload Semester Results
            <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} hidden />
          </label>
          <button onClick={exportToExcel} disabled={loading}>
            <FaFileExcel /> Export Excel
          </button>
          <button onClick={exportToPDF} disabled={loading}>
            <FaFilePdf /> Export PDF
          </button>
          <button onClick={toggleDarkMode} className="theme-toggle">
            {darkMode ? <FaSun /> : <FaMoon />}
          </button>
        </div>
      </header>

      <div className="dashboard-content">
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

        <div className="student-grid">
          {filteredStudents.map((student) => (
            <div key={student.student_id} className="student-card">
              <div className="card-front">
                <h3>Student ID: {student.student_id}</h3>
                <p>Name: {student.name}</p>
                <p>Department: {student.department}</p>
                <p>Average: {student.average || "N/A"}</p>
                <div className="card-actions">
                  <button className="details-btn">
                    <FaEye /> Show Details
                  </button>
                  <button className="add-marks-btn" onClick={(e) => openUpdateMarksModal(student, e)}>
                    Add Marks
                  </button>
                  <button className="delete-btn" onClick={(e) => handleDelete(student.student_id, e)}>
                    <FaTrash />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div className="student-card add-student-card" onClick={openAddStudentModal}>
            <div className="card-front">
              <h3>Add a new student</h3>
              <button className="add-student-btn">
                <FaPlus />
              </button>
            </div>
          </div>
        </div>
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