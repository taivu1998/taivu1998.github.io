---
layout: page
title: "PhotoShare: Full-Stack SPA with Per-Photo Visibility Control"
description: "A photo-sharing web application with user authentication, user profiles, user listing, photo sharing, favorite lists, commenting, and activity feeds"
importance: 6
category: "Web & App Development"
github: https://github.com/taivu1998/PhotoWebApp
---

[![](https://img.shields.io/badge/GitHub-View_on_GitHub-blue?logo=GitHub)](https://github.com/taivu1998/PhotoWebApp)

## Overview

PhotoShare is a **full-stack single-page application** built as the capstone project for Stanford CS 142 (Web Applications), implementing a social photo sharing platform with **per-photo granular visibility control** via user whitelists. The system combines a **React 16 SPA** (Material-UI components, HashRouter client-side routing, Axios HTTP client) with an **Express 4 REST API** (15+ endpoints, session-based authentication, Multer in-memory file uploads) backed by **MongoDB via Mongoose ODM** (embedded comment sub-documents, denormalized activity records). The authentication layer uses **SHA-1 password hashing with per-user random salts** (8-byte `crypto.randomBytes`), while photo access control enforces visibility whitelists across all API endpoints including **activity feed redaction** — blanking photo thumbnails in activity entries for photos the requesting user cannot see. Cross-component data synchronization uses a **boolean flip propagation pattern** as a lightweight alternative to Redux. The project includes a **36-test Mocha suite** covering password hashing, API authorization, session management, CRUD operations, and file uploads.

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    CLIENT TIER                            │
│  React 16.5 + Material-UI 4.9 + React Router 5 (Hash)   │
│  Webpack 4 → compiled/photoShare.bundle.js               │
├──────────────────────────────────────────────────────────┤
│                   SERVER TIER                             │
│  Express 4.16 + express-session + Multer + body-parser   │
│  webServer.js (15+ REST endpoints, port 3000)            │
├──────────────────────────────────────────────────────────┤
│                   DATA TIER                               │
│  MongoDB via Mongoose 5.9 ODM                             │
│  Collections: Users, Photos, Activities, SchemaInfos     │
└──────────────────────────────────────────────────────────┘
```

The application operates as a client-side SPA served from a single `photo-share.html` entry point. React renders into `#photoshareapp`, all routing is handled client-side via `HashRouter` (URLs like `#/users/:userId`, `#/photos/:userId`), and every data operation flows through Axios calls to the Express REST API.

## Database Schema (Mongoose ODM)

### Entity Relationships

```
┌──────────┐       ┌──────────────┐       ┌──────────────┐
│   User   │──1:N──│    Photo     │──1:N──│   Comment    │
│          │       │              │       │  (embedded)  │
│ _id      │       │ _id          │       │ _id          │
│ first_   │       │ file_name    │       │ comment      │
│ last_    │       │ date_time    │       │ date_time    │
│ location │       │ user_id ─────│───┐   │ user_id ────►│── User
│ login_   │       │ comments[]   │   │   └──────────────┘
│ password │       │ use_vis_list │   │
│ salt     │       │ vis_list[] ──│───┘── [User._id, ...]
└──────────┘       └──────────────┘
      │ 1:N
      ▼
┌──────────────┐
│   Activity   │
│ user_id      │
│ activity_type│   ("User logging in.", "A photo upload.",
│ date_time    │    "A comment added.", "User registering.",
│ photo_file   │    "User logging out.")
│ photo_user   │   ← denormalized owner name
└──────────────┘
```

**Comments are embedded** within Photo documents as Mongoose sub-documents — a denormalized design optimized for read-heavy photo viewing where comments are always fetched alongside their parent photo. Photo visibility uses a **dual-field ACL**: a boolean toggle (`use_visibility_list`) and an array of allowed ObjectIds (`visibility_list`). When the toggle is `false`, the photo is public.

### Photo Schema with Embedded Comments

```javascript
var commentSchema = new mongoose.Schema({
    comment: String,
    date_time: {type: Date, default: Date.now},
    user_id: mongoose.Schema.Types.ObjectId,
});

var photoSchema = new mongoose.Schema({
    file_name: String,
    date_time: {type: Date, default: Date.now},
    user_id: mongoose.Schema.Types.ObjectId,
    comments: [commentSchema],                              // Embedded sub-documents
    use_visibility_list: {type: Boolean, default: false},
    visibility_list: [mongoose.Schema.Types.ObjectId],      // Whitelist of allowed viewers
});
```

## Authentication System

### SHA-1 Salted Password Hashing

```javascript
function makePasswordEntry(clearTextPassword) {
    var salt = crypto.randomBytes(8).toString('hex');  // 16 hex chars = 8 bytes entropy
    var hash = crypto.createHash('sha1').update(clearTextPassword + salt).digest('hex');
    return { salt: salt, hash: hash };  // 40 hex chars (160-bit SHA-1 digest)
}

function doesPasswordMatch(hash, salt, clearTextPassword) {
    var computedHash = crypto.createHash('sha1').update(clearTextPassword + salt).digest('hex');
    return computedHash === hash;
}
```

Each user's password is stored as a 40-character SHA-1 digest with a unique 16-character hex salt generated via `crypto.randomBytes()`. Password fields (`password_digest`, `salt`) are explicitly excluded from all API responses — the login endpoint deletes them from the response object, and user detail endpoints use Mongoose `.select()` projection.

### Session-Based Authentication

```javascript
app.use(session({secret: 'secretKey', resave: false, saveUninitialized: false}));
```

Server-side sessions via `express-session` store `login_name` and `user_id` after successful authentication. Every protected endpoint begins with an inline session check (`if (!request.session.login_name) → 401`). The login flow queries `User.findOne({login_name})`, verifies the password hash, creates a "User logging in." Activity, and returns the user object with sensitive fields stripped.

## Per-Photo Visibility Control

The most technically interesting feature — **granular per-photo access control** enforced across all API endpoints:

### Upload-Time ACL Configuration

The `PhotoUpload` component presents a radio group (public/restricted) and a checkbox list of all registered users. On upload, `useVisibilityList` (boolean) and `visibilityList` (JSON-stringified ObjectId array) are sent alongside the multipart file data.

### Server-Side Visibility Enforcement

```javascript
// Applied on /photosOfUser/:id, /mostRecentPhoto/:id, /photoWithMostComment/:id
var photoListVisible = photoList.filter(photo => {
    return !photo.use_visibility_list ||                                    // Public photo
           String(request.session.user_id) === String(photo.user_id) ||     // Owner always sees
           photo.visibility_list.map(String).indexOf(
               String(request.session.user_id)) !== -1;                     // On whitelist
});
```

Visibility is enforced on **six endpoints**: photo listing, most recent photo, most commented photo, comment submission (returns 403 for unauthorized visibility), activity feed, and per-user last activity. Visibility fields (`use_visibility_list`, `visibility_list`) are stripped from all API responses to prevent information leakage.

### Activity Feed Redaction

The `/recentActivities` endpoint performs a batch lookup of photos referenced in activity entries, then **blanks out `photo_file_name`** for any photos the current user cannot see — preventing restricted photo thumbnails from leaking through the activity feed.

## File Upload Pipeline

```javascript
var processFormBody = multer({storage: multer.memoryStorage()}).single('uploadedphoto');
```

Multer with **in-memory storage** buffers the uploaded file as a `Buffer` object. The upload handler validates the file (existence, non-empty `originalname`, non-zero `size`), generates a unique filename (`"U" + Date.now() + originalFilename`), and writes the buffer to `./images/` via `fs.writeFile()`. Photos are served statically via `express.static(__dirname)`.

## React SPA Frontend

### Component Hierarchy

```
PhotoShare (Root) ─── auth state, flip triggers, route config
├── TopBar                     [AppBar, logout, upload button, activity link]
├── UserList                   [Sidebar: user names + per-user last activity]
│   ├── UserLink               [Navigable link to user profile]
│   └── LastActivity → Activity [Most recent activity per user]
└── [Main Content — switched by HashRouter]
    ├── UserDetail             [Profile + most-recent & most-commented photos]
    ├── UserPhotos             [Gallery with comment forms per photo]
    │   └── Photo → Comment    [Card with image, timestamp, comments]
    ├── LoginRegister          [Side-by-side LoginForm + RegisterForm]
    ├── PhotoUpload            [File picker + visibility controls]
    └── ActivityFeed           [5 most recent platform-wide activities]
```

### Client-Side Routing

| Route | Component | Description |
|-------|-----------|-------------|
| `/login-register` | LoginRegister | Side-by-side login + 8-field registration |
| `/users/:userId` | UserDetail | Profile info + featured photos |
| `/photos/:userId` | UserPhotos | Photo gallery with inline comment forms |
| `/photoupload` | PhotoUpload | File picker + visibility whitelist |
| `/activityfeed` | ActivityFeed | 5 most recent activities |
| `/` | Redirect | → own profile (logged in) or login page |

**Conditional routing**: When `userIsLoggedIn` is `false`, all routes redirect to `/login-register`. When `true`, the login page redirects to the user's own profile.

### Boolean Flip State Propagation

A lightweight alternative to Redux for cross-component data synchronization:

```javascript
// Root state
this.state = {
    newPhotoUploadedFlipped: false,    // Toggled on photo upload
    newActivityAddedFlipped: false,    // Toggled on any activity
};

// Child components detect the change in componentDidUpdate and re-fetch
componentDidUpdate(prevProps) {
    if (this.props.newPhotoUploadedFlipped !== prevProps.newPhotoUploadedFlipped) {
        this.fetchPhotos();  // Re-fetch from API
    }
}
```

When a photo is uploaded or activity occurs, the root component toggles a boolean (true→false or false→true). Child components detect the prop change in `componentDidUpdate` and re-fetch data from the API. This avoids passing actual data upward — only a signal that something changed.

## REST API (15+ Endpoints)

| Method | Endpoint | Auth | Purpose |
|--------|----------|:----:|---------|
| `GET` | `/user/list` | Yes | All users (projected: `_id`, `first_name`, `last_name`) |
| `GET` | `/user/:id` | Yes | User profile (excludes password fields via `.select()`) |
| `GET` | `/photosOfUser/:id` | Yes | Visibility-filtered photos with populated comments |
| `GET` | `/mostRecentPhoto/:id` | Yes | Most recently uploaded visible photo |
| `GET` | `/photoWithMostComment/:id` | Yes | Photo with most comments (visible only) |
| `GET` | `/recentActivities` | Yes | 5 most recent activities with photo redaction |
| `GET` | `/lastActivity/:id` | Yes | Most recent activity for specific user |
| `POST` | `/admin/login` | No | Authenticate + create session + log activity |
| `POST` | `/admin/logout` | Yes | Destroy session + log activity |
| `POST` | `/commentsOfPhoto/:photo_id` | Yes | Add comment (with visibility check → 403) |
| `POST` | `/photos/new` | Yes | Multer upload + visibility config + log activity |
| `POST` | `/user` | No | Register with salt+hash generation + log activity |

**Field projection** via Mongoose `.select()` ensures password fields are never exposed. **Manual comment population** uses `async.each` with individual `User.findOne` queries per comment, providing fine-grained field control over the populated user objects.

## Activity Tracking System

Five event types are tracked as denormalized Activity documents:

| Event | Trigger | Extra Fields |
|-------|---------|-------------|
| `"User logging in."` | `POST /admin/login` | — |
| `"User logging out."` | `POST /admin/logout` | — |
| `"User registering."` | `POST /user` | — |
| `"A photo upload."` | `POST /photos/new` | `photo_file_name` |
| `"A comment added."` | `POST /commentsOfPhoto/:id` | `photo_file_name`, `photo_user_name` |

Activities are queried with `.sort({date_time: -1}).limit(5)` for the platform feed and `.sort().limit(1)` for per-user last activity. The `Activity` component renders context-aware styles — larger typography (`h6`) and icons for the activity feed, smaller (`caption`) for the user list sidebar.

## Material-UI Component Library

| Material-UI Component | Usage |
|----------------------|-------|
| `AppBar` + `Toolbar` | Top navigation with logout/upload/activity buttons |
| `Grid` + `Paper` | 3/9 responsive sidebar/content split |
| `Card` + `CardContent` + `CardMedia` | Photo cards and comment cards |
| `TextField` | Login/register inputs and comment boxes |
| `Snackbar` + `Alert` (`@material-ui/lab`) | Toast notifications for success/error feedback |
| `FormControl` + `RadioGroup` + `Checkbox` | Photo visibility controls on upload |
| `List` + `ListItem` + `Divider` | User sidebar list |
| `Typography` | Variant hierarchy (h4, h5, body1, body2, caption) |
| Icons | `CloudUpload`, `ExitToApp`, `AddComment`, `PhotoAlbum`, `AccountCircle` |

Color scheme: Comment cards in LavenderBlush (`#FFF0F5`), activity cards in GhostWhite (`#F8F8FF`), photo cards in HoneyDew (`#F0FFF0`).

## Test Suite (36 Mocha Tests)

| Test File | Tests | Coverage |
|-----------|:-----:|---------|
| `cs142passwordTest.js` | 5 | Salt/hash generation, type/length validation, 100-call uniqueness, match/reject |
| `serverApiTest.js` | 12 | Session cookie, user list count + fields, user detail per-user, photo counts + comments, invalid ID → 400 |
| `sessionInputApiTest.js` | 19 | 401 for unauthorized, login rejection (bad user/password), login+access+logout cycle, comment creation + verification, photo upload + gallery verification, registration + duplicate rejection |

## Demo

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/CS142_Demo4.gif" title="Photo Sharing App Demo" class="img-fluid rounded z-depth-1" %}
    </div>
</div>

## Tech Stack

JavaScript (ES6+), React (16.5), Material-UI (4.9), React Router (5.1), Axios, Express (4.16), express-session, Multer (1.4), body-parser, Mongoose (5.9), MongoDB, async (3.1), Webpack (4), Babel (6), Mocha, Node.js
