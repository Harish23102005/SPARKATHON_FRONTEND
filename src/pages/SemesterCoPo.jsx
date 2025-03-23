// SemesterCoPo.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FaFileUpload, FaPrint, FaArrowLeft } from "react-icons/fa";
import "./SemesterCoPo.css";

const SemesterCoPo = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState({
    internal: null,
    assignment: null,
    classTest: null,
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e, type) => {
    setFiles({ ...files, [type]: e.target.files[0] });
  };

  const calculateResults = async () => {
    if (!files.internal || !files.assignment || !files.classTest) {
      alert("Please upload all required files.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("internal", files.internal);
    formData.append("assignment", files.assignment);
    formData.append("classTest", files.classTest);

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        "http://localhost:5000/api/calculate-semester-co-po",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      setResults(response.data);
    } catch (error) {
      console.error("Error calculating results:", error);
      alert(error.response?.data?.error || "Failed to calculate results.");
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!results) return;

    const doc = new jsPDF();
    doc.text("Semester CO/PO Attainment Report", 10, 10);

    // CO Attainment Table
    doc.text("CO Attainment", 10, 20);
    const coHead = [["CO", "Internal", "Assignment", "Class Test", "Average", "Target Attained"]];
    const coBody = results.coAttainment.map((co) => [
      co.coId,
      co.internal.toFixed(2),
      co.assignment.toFixed(2),
      co.classTest.toFixed(2),
      co.average.toFixed(2),
      co.targetAttained ? "Yes" : "No",
    ]);
    autoTable(doc, { head: coHead, body: coBody, startY: 30 });

    // PO Attainment Table
    const poStartY = doc.lastAutoTable.finalY + 10;
    doc.text("PO Attainment", 10, poStartY);
    const poHead = [["PO", "Attainment", "Target Attained"]];
    const poBody = results.poAttainment.map((po) => [
      po.poId,
      po.attainment.toFixed(2),
      po.targetAttained ? "Yes" : "No",
    ]);
    autoTable(doc, { head: poHead, body: poBody, startY: poStartY + 10 });

    doc.save("SemesterCoPoReport.pdf");
  };

  return (
    <div className="semester-co-po-container">
      <div className="semester-header">
        <button onClick={() => navigate("/dashboard")} className="back-btn">
          <FaArrowLeft /> Back to Dashboard
        </button>
        <h2>Semester CO/PO Calculation</h2>
        {results && (
          <button onClick={exportToPDF} className="print-btn">
            <FaPrint /> Print Report
          </button>
        )}
      </div>

      <div className="file-upload-section">
        <div className="file-input">
          <label>Internal Assessment File:</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleFileChange(e, "internal")}
          />
        </div>
        <div className="file-input">
          <label>Assignment File:</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleFileChange(e, "assignment")}
          />
        </div>
        <div className="file-input">
          <label>Class Test File:</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleFileChange(e, "classTest")}
          />
        </div>
        <button onClick={calculateResults} disabled={loading} className="calculate-btn">
          <FaFileUpload /> {loading ? "Calculating..." : "Calculate Results"}
        </button>
      </div>

      {results && (
        <div className="results-section">
          <h3>CO Attainment</h3>
          <table className="results-table">
            <thead>
              <tr>
                <th>CO</th>
                <th>Internal</th>
                <th>Assignment</th>
                <th>Class Test</th>
                <th>Average</th>
                <th>Target Attained</th>
              </tr>
            </thead>
            <tbody>
              {results.coAttainment.map((co, index) => (
                <tr key={index}>
                  <td>{co.coId}</td>
                  <td>{co.internal.toFixed(2)}</td>
                  <td>{co.assignment.toFixed(2)}</td>
                  <td>{co.classTest.toFixed(2)}</td>
                  <td>{co.average.toFixed(2)}</td>
                  <td>{co.targetAttained ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>PO Attainment</h3>
          <table className="results-table">
            <thead>
              <tr>
                <th>PO</th>
                <th>Attainment</th>
                <th>Target Attained</th>
              </tr>
            </thead>
            <tbody>
              {results.poAttainment.map((po, index) => (
                <tr key={index}>
                  <td>{po.poId}</td>
                  <td>{po.attainment.toFixed(2)}</td>
                  <td>{po.targetAttained ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SemesterCoPo;