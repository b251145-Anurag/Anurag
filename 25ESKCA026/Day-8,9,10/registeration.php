<?php
include('header.php');
include('db_connect.php');
include("checkRegisterationError.php");
?>
<div class="container mt-5" style="max-width: 400px;">
    <form action="" method="post">
    <h3 class="mb-3">Register</h3>
    <input type="text" name="name" class="form-control mb-3" placeholder="Enter your name">

    <input type="email" name="email" class="form-control mb-3" placeholder="Enter your email">

    <input type="password" name="password" class="form-control mb-3" placeholder="Enter your password">
    <input type="password" name="confirmPassword" class="form-control mb-3" placeholder="Confirm your password">
    <button type="submit" class="btn btn-primary w-100">Register</button>
    </form>
</div>

<?php
include('footer.php');
?>