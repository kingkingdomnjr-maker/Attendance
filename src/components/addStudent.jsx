function AddStudent({ newStudent, setNewStudent, addStudent }){

  return (
    <div>
      <input
        type="text"
        placeholder="enter your name"
        value={newStudent}
  onChange={(e) => setNewStudent(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      addStudent();
    }
  }}
      />

      <button onClick={addStudent}>
        Add Student
      </button>
    </div>
  );
}

export default AddStudent;