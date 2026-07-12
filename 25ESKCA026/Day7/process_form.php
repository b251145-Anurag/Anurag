<?php

include("db_connect.php");

if ($_SERVER["REQUEST_METHOD"] == "POST") {

    $name = mysqli_real_escape_string($conn, $_POST["name"]);
    $college = mysqli_real_escape_string($conn, $_POST["college"]);
    $branch = mysqli_real_escape_string($conn, $_POST["branch"]);
   

    $sql = "INSERT INTO students (name, college, branch)
            VALUES ('$name', '$college', '$branch' )";

    if (mysqli_query($conn, $sql)) {
        echo "Student Registered Successfully!";
    } else {
        echo "Error: " . mysqli_error($conn);
    }
}

?>