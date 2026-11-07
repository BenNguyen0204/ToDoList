const themeButtons = document.querySelectorAll(".themeButton");

if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
}

themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
        document.body.classList.toggle("dark");
        localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
    });
});