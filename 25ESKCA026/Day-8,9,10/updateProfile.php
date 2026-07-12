<?php
include("db_connection.php");
include("header.php");
?>
<div>
    <class="container mt-5 text-align">
    <h2>Update Profile</h2>
    <form method="POST" action="">
        <label for="name">Name:</label>
        <input type="text" id="name" name="name" required><br><br>

        <label for="email">Email:</label>
        <input type="email" id="email" name="email" required><br><br>

        <input type="submit" value="Update Profile">
    </form>
</div>
<?php
include("footer.php");
?>
