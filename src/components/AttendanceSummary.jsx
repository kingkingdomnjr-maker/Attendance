
function AttendanceSummary({ students }) {
  const present = students.filter(
    (student) => student.status === "present"
  ).length;

  const absent = students.filter(
    (student) => student.status === "absent"
  ).length;

  const unmarked = students.filter(
    (student) => student.status === "unmarked"
  ).length;

  return (
    <div>
      <h2>Present: {present}</h2>
      <h2>Absent: {absent}</h2>
      <h2>Not Marked: {unmarked}</h2>
    </div>
  );
}

export default AttendanceSummary;
