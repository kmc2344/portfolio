const express = require("express");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const nodemailer = require("nodemailer");
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
// Mail (Contact)
// ==============================
const CONTACT_TO = "kmc2344@kamiyama.ac.jp";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || "false") === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

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

// ===== Contact =====
app.get("/contact", (req, res) => {
  const sent = req.query.sent === "1";
  const error = req.query.error === "1";
  res.render("contact", { page: "contact", sent, error });
});

app.post("/contact", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const email = (req.body.email || "").trim();
    const subject = (req.body.subject || "").trim();
    const message = (req.body.message || "").trim();

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!name || !emailOk || !message) {
      return res.redirect("/contact?error=1");
    }

    const humanSubject = subject || "No Subject";
    const from = process.env.MAIL_FROM || process.env.SMTP_USER;

    await transporter.sendMail({
      from,
      to: CONTACT_TO,
      replyTo: email,
      subject: `[Portfolio Contact] ${humanSubject} - ${name}`,
      text:
        `Name: ${name}\n` +
        `Email: ${email}\n` +
        `Subject: ${humanSubject}\n\n` +
        `${message}\n`
    });

    await transporter.sendMail({
      from,
      to: email,
      subject: `【受付完了】お問い合わせありがとうございます`,
      text:
        `${name} 様\n\n` +
        `お問い合わせを受け付けました。\n\n` +
        `--- 送信内容 ---\n` +
        `件名: ${humanSubject}\n` +
        `本文:\n${message}\n`
    });

    res.redirect("/contact?sent=1");
  } catch (e) {
    console.error(e);
    res.redirect("/contact?error=1");
  }
});

// ===== Works / Projects list（ハイブリッド） =====
app.get("/works", async (req, res) => {
  const extraWorks = await prisma.work.findMany({
    orderBy: { createdAt: "desc" }
  });

  res.render("works", {
    page: "works",
    extraWorks
  });
});

app.get("/projects", async (req, res) => {
  const extraProjects = await prisma.project.findMany({
    where: {
      slug: {
        notIn: ["hanabi", "sony", "iot"]
      }
    },
    orderBy: { createdAt: "desc" }
  });

  res.render("projects", {
    page: "projects",
    extraProjects
  });
});


// ==============================
// Project pages（静的）
// ==============================
app.get("/project/hanabi", (req, res) => {
  res.render("project-hanabi", { page: "projects" });
});
app.get("/project/sony", (req, res) => {
  res.render("project-sony", { page: "projects" });
});
app.get("/project/iot", (req, res) => {
  res.render("project-iot", { page: "projects" });
});

// ==============================
// History
// ==============================
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

  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
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
// Admin: Work（画像パス手入力）
// ==============================
app.post("/admin/work", requireLogin, async (req, res) => {
  const data = {
    title: req.body.title,
    desc: req.body.desc
  };

  if (req.body.image && req.body.image.trim() !== "") {
    data.image = req.body.image.trim();
  }

  await prisma.work.create({ data });
  res.redirect("/admin");
});

app.get("/admin/work/:id/edit", requireLogin, async (req, res) => {
  const work = await prisma.work.findUnique({
    where: { id: Number(req.params.id) }
  });
  if (!work) return res.status(404).send("Work not found");
  res.render("work_edit", { work });
});

app.post("/admin/work/:id/edit", requireLogin, async (req, res) => {
  const id = Number(req.params.id);
  const data = {
    title: req.body.title,
    desc: req.body.desc
  };
  if (req.body.image && req.body.image.trim() !== "") {
    data.image = req.body.image.trim();
  }
  await prisma.work.update({ where: { id }, data });
  res.redirect("/admin");
});

app.post("/admin/work/:id/delete", requireLogin, async (req, res) => {
  await prisma.work.delete({ where: { id: Number(req.params.id) } });
  res.redirect("/admin");
});

// ==============================
// Admin: Project（画像パス手入力）
// ==============================
app.post("/admin/project", requireLogin, async (req, res) => {
  const data = {
    slug: req.body.slug,
    title: req.body.title,
    summary: req.body.summary,
    overview: req.body.overview,
    background: req.body.background,
    approach: req.body.approach,
    result: req.body.result,
    featured: req.body.featured === "on"
  };

  if (req.body.image && req.body.image.trim() !== "") {
    data.image = req.body.image.trim();
  }

  await prisma.project.create({ data });
  res.redirect("/admin");
});

app.get("/admin/project/:id/edit", requireLogin, async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: Number(req.params.id) }
  });
  if (!project) return res.status(404).send("Project not found");
  res.render("project_edit", { project });
});

app.post("/admin/project/:id/edit", requireLogin, async (req, res) => {
  const id = Number(req.params.id);
  const data = {
    slug: req.body.slug,
    title: req.body.title,
    summary: req.body.summary,
    overview: req.body.overview,
    background: req.body.background,
    approach: req.body.approach,
    result: req.body.result,
    featured: req.body.featured === "on"
  };

  if (req.body.image && req.body.image.trim() !== "") {
    data.image = req.body.image.trim();
  }

  await prisma.project.update({ where: { id }, data });
  res.redirect("/admin");
});

app.post("/admin/project/:id/delete", requireLogin, async (req, res) => {
  await prisma.project.delete({ where: { id: Number(req.params.id) } });
  res.redirect("/admin");
});

// ==============================
// Server
// ==============================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});
