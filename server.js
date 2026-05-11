const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let tasks = [
  { title: "Project", status: "pending" },
  { title: "Power BI", status: "pending" }
];
let emailDrafts = [];

app.get("/", (req, res) => {
  res.send("CEO Assistant API is running");
});

app.get("/api/tasks", (req, res) => {
  res.json(tasks);
});

app.post("/api/tasks", (req, res) => {
  const task = {
    title: req.body.title,
    status: req.body.status || "pending",
    priority: req.body.priority || "medium"
  };

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
app.get("/api/email-drafts", (req, res) => {
  res.json(emailDrafts);
});

app.post("/api/email-drafts", (req, res) => {
  const draft = {
    id: emailDrafts.length + 1,
    to: req.body.to || "",
    subject: req.body.subject || "No subject",
    body: req.body.body || "",
    status: "draft"
  };

  emailDrafts.push(draft);
  res.json(draft);
});

app.delete("/api/email-drafts/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = emailDrafts.findIndex(d => d.id === id);

  if (index === -1) {
    return res.status(404).json({ message: "Draft not found" });
  }

  const deleted = emailDrafts.splice(index, 1);
  res.json({ message: "Draft deleted", deleted });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
