<?php

$name = $_POST['name'];
$college = $_POST['college'];
$branch = $_POST['branch'];

echo "<h1>Welcome to the Registration Page</h1>";
echo "<h2>Registration Successful</h2>";
echo "<h3>Name: $name</h3>";
function getFormattedDate() {
    return date("l,F j,Y");
}
echo "<h3>College: $college</h3>";
echo "<h3>Branch: $branch</h3>";
echo "<h3>Date: " . getFormattedDate() . "</h3>";