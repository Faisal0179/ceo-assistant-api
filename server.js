const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let tasks = [
  { title: "Project", status: "pending" },
  { title: "Power BI", status: "pending" }
];

app.get("/", (req, res) => {
  res.send("CEO Assistant API is running");
});

app.get("/api/tasks", (req, res) => {
  res.json(tasks);
});

app.post("/api/tasks", (req, res) => {
  const task = req.body;
  tasks.push(task);
  res.json(task);
});
app.put("/api/tasks/:title", (req, res) => {
  const title = req.params.title;

  const task = tasks.find(t => t.title.toLowerCase() === title.toLowerCase());

  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  task.status = req.body.status || "completed";

  res.json(task);
});
app.delete("/api/tasks/:title", (req, res) => {
  const title = req.params.title;

  const index = tasks.findIndex(t => t.title.toLowerCase() === title.toLowerCase());

  if (index === -1) {
    return res.status(404).json({ message: "Task not found" });
  }

  const deleted = tasks.splice(index, 1);

  res.json({ message: "Task deleted", deleted });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
