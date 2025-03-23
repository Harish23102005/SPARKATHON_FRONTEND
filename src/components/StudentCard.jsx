import React from "react";
import "./StudentCard.css";

const StudentCard = ({ student, onDelete }) => {
  return (
    <div className="student-card">
      <h3>{student.name}</h3>
      <p><strong>ID:</strong> {student.studentId}</p>
      <p><strong>Average Marks:</strong> {student.average}%</p>

      <button className="delete-btn" onClick={() => onDelete(student.studentId)}>
        ❌ Delete
      </button>
    </div>
  );
};

export default StudentCard;