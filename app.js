const express = require("express");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();
const session = require("express-session");

const app = express();
const prisma = new PrismaClient();

// ==============================
// Session
// ==============================
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// ==============================
// View / Static / Body
// ==============================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

// ==============================
// Auth middleware
// ==============================
function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.redirect("/login");
}

// ==============================
// Public pages
// ==============================
app.get("/", async (req, res) => {
  const projects = await prisma.project.findMany({
    where: { featured: true },
    orderBy: { createdAt: "desc" }
  });

  const works = await prisma.work.findMany({
    take: 3,
    orderBy: { createdAt: "desc" }
  });

  res.render("index", { page: "home", projects, works });
});

app.get("/about", (req, res) => {
  res.render("about", { page: "about" });
});

app.get("/works", async (req, res) => {
  const works = await prisma.work.findMany({
    orderBy: { createdAt: "desc" }
  });
  res.render("works", { works, page: "works" });
});

app.get("/projects", async (req, res) => {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" }
  });
  res.render("projects", { projects, page: "projects" });
});

app.get("/project/:slug", async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { slug: req.params.slug }
  });

  if (!project) return res.status(404).send("Project not found");

  res.render("project", { ...project, page: "projects" });
});

app.get("/history", (req, res) => {
  res.render("history", { page: "history" });
});

// ==============================
// Login / Logout
// ==============================
app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    req.session.loggedIn = true;
    return res.redirect("/admin");
  }

  res.render("login", { error: "ユーザー名またはパスワードが違います" });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// ==============================
// Admin dashboard
// ==============================
app.get("/admin", requireLogin, async (req, res) => {
  const works = await prisma.work.findMany({
    orderBy: { createdAt: "desc" }
  });

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" }
  });

  res.render("admin", { works, projects });
});

// ==============================
// Featured toggle（Project）
// ==============================
app.post("/admin/project/:id/featured", requireLogin, async (req, res) => {
  const id = Number(req.params.id);

  await prisma.project.update({
    where: { id },
    data: {
      featured: req.body.featured === "on"
    }
  });

  res.redirect("/admin");
});

// ==============================
// Work: Create
// ==============================
app.post("/admin/work", requireLogin, async (req, res) => {
  await prisma.work.create({
    data: {
      title: req.body.title,
      desc: req.body.desc,
      image: req.body.image
    }
  });

  res.redirect("/admin");
});

// ==============================
// Work: Edit (GET)
// ==============================
app.get("/admin/work/:id/edit", requireLogin, async (req, res) => {
  const work = await prisma.work.findUnique({
    where: { id: Number(req.params.id) }
  });

  if (!work) return res.status(404).send("Work not found");

  res.render("work_edit", { work });
});

// ==============================
// Work: Edit (POST)
// ==============================
app.post("/admin/work/:id/edit", requireLogin, async (req, res) => {
  const id = Number(req.params.id);

  await prisma.work.update({
    where: { id },
    data: {
      title: req.body.title,
      desc: req.body.desc,
      image: req.body.image
    }
  });

  res.redirect("/admin");
});

// ==============================
// Work: Delete
// ==============================
app.post("/admin/work/:id/delete", requireLogin, async (req, res) => {
  const id = Number(req.params.id);

  await prisma.work.delete({
    where: { id }
  });

  res.redirect("/admin");
});

// ==============================
// Project: Create
// ==============================
app.post("/admin/project", requireLogin, async (req, res) => {
  await prisma.project.create({
    data: {
      slug: req.body.slug,
      title: req.body.title,
      summary: req.body.summary,
      overview: req.body.overview,
      background: req.body.background,
      approach: req.body.approach,
      result: req.body.result,
      image: req.body.image,
      featured: req.body.featured === "on"
    }
  });

  res.redirect("/admin");
});

// ==============================
// Project: Edit (GET)
// ==============================
app.get("/admin/project/:id/edit", requireLogin, async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: Number(req.params.id) }
  });

  if (!project) return res.status(404).send("Project not found");

  res.render("project_edit", { project });
});

// ==============================
// Project: Edit (POST)
// ==============================
app.post("/admin/project/:id/edit", requireLogin, async (req, res) => {
  const id = Number(req.params.id);

  await prisma.project.update({
    where: { id },
    data: {
      slug: req.body.slug,
      title: req.body.title,
      summary: req.body.summary,
      overview: req.body.overview,
      background: req.body.background,
      approach: req.body.approach,
      result: req.body.result,
      image: req.body.image,
      featured: req.body.featured === "on"
    }
  });

  res.redirect("/admin");
});

// ==============================
// Project: Delete
// ==============================
app.post("/admin/project/:id/delete", requireLogin, async (req, res) => {
  const id = Number(req.params.id);

  await prisma.project.delete({
    where: { id }
  });

  res.redirect("/admin");
});

// ==============================
// Server
// ==============================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});
