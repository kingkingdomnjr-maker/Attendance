import { useState } from "react";

function StudentUI({student,markAttendance,deleteStudent,editStudent
}){
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(student.name);

return(
  <div className="student-item">
    
    {isEditing ? (
      <>
  <input type="text"
   value={editedName}
   onChange={(e) => setEditedName(e.target.value)} />
   <button
  onClick={() => {
     if (editedName.trim() === "") {
    return;
  }
    editStudent(student.id, editedName);
    setIsEditing(false);
  }}
>
  Save
</button>
<button
  onClick={() => {
    setEditedName(student.name);
    setIsEditing(false);
  }}
>
  Cancel
</button>

</>

) : (
    <h2>{student.name}</h2>)} 
  <p>
  {student.status === "present"
    ? "Present ✓"
    : student.status === "absent"
    ? "Absent"
    : "Not Marked"}
</p>
<div>
    <button onClick={() => markAttendance(student.id,"present")}>present</button>
    <button onClick={() => markAttendance(student.id,"absent")}>absent</button>
    <button onClick={() =>deleteStudent(student.id)}>delete</button>
    <button onClick={() => setIsEditing(true)}>Edit</button>
    </div>
  </div>
);

}
export default StudentUI;
