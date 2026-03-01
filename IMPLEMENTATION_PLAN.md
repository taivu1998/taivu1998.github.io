# Personal Portfolio Website - Implementation Plan

## 1. Template Selection & Rationale

### Chosen Template: [al-folio](https://github.com/alshedivat/al-folio) (Jekyll)

**The industry standard for AI researchers.** 15.1k stars, 12.8k forks. Used by researchers at CMU, UCLA, Caltech, Johns Hopkins, and for NeurIPS/ICLR/ICML workshops.

**Why al-folio is the right choice:**

| Requirement | al-folio Solution |
|-------------|-------------------|
| Publications with links | BibTeX auto-parsing via `jekyll-scholar` — just add `.bib` entries |
| Project grid with detail pages | Built-in `_projects/` collection with card grid + individual pages |
| CV with timeline | RenderCV format (`_data/cv.yml`) with automatic PDF generation |
| Social links (Gmail, LinkedIn, GitHub, X) | Built-in via `_config.yml` — just fill in usernames |
| Responsive design | Bootstrap 4.6 grid, mobile-first, battle-tested |
| Dark/light mode | Built-in toggle, auto-detects system preference |
| GitHub Pages deployment | One-click via GitHub Actions (auto-deploy on push) |
| Professional credibility | Recruiters/researchers recognize the format instantly |
| Search | Built-in search (Ctrl+K) across all content |
| Math support | MathJax built-in (useful for research content) |

**What al-folio gives us for free** (vs. building from scratch):
- Responsive navbar with hamburger menu
- Publication badge system (arXiv, PDF, code, slides, poster links)
- Lazy image loading
- SEO meta tags & Open Graph
- Font Awesome + Academicons
- Syntax highlighting
- Lighthouse-optimized performance
- Accessibility (semantic HTML, ARIA, focus styles)

---

## 2. Site Architecture

### 2.1 Navigation Structure

```
Tai Vu                          About | CV | Portfolio | Contact
─────────────────────────────────────────────────────────────────
```

**4 pages** in the top navigation:
1. **About** (`/`) — Landing page with profile, bio, selected publications
2. **CV** (`/cv/`) — Full curriculum vitae
3. **Portfolio** (`/portfolio/`) — Projects grid + Publications list
4. **Contact** (`/contact/`) — Contact info + resume download

### 2.2 File Structure (al-folio customized)

```
Personal_Website/
├── _config.yml                          # Main site configuration
├── _pages/
│   ├── about.md                         # About page (landing)
│   ├── cv.md                            # CV page
│   ├── portfolio.md                     # Portfolio: projects + publications
│   └── contact.md                       # Contact page (custom)
├── _projects/                           # Individual project files
│   ├── 1_ganime.md
│   ├── 2_flapai_bird.md
│   ├── 3_privacy_preserving.md
│   ├── 4_resnet_pruning.md
│   ├── 5_manga_detection.md
│   ├── 6_photo_sharing.md
│   ├── 7_stock_charts.md
│   ├── 8_shiptivitas.md
│   ├── 9_game_2048.md
│   └── 10_exchange_rates.md
├── _bibliography/
│   └── papers.bib                       # All publications in BibTeX
├── _data/
│   ├── cv.yml                           # CV data (RenderCV format)
│   └── repositories.yml                 # GitHub repos to showcase
├── _news/
│   └── announcement_1.md               # News items for about page
├── assets/
│   ├── img/
│   │   ├── prof_pic.png                 # Profile photo
│   │   └── projects/                    # Project images
│   │       ├── GANime_Demo.png
│   │       ├── GANime_Poster.png
│   │       ├── FlapAI-Bird_Demo.gif
│   │       ├── FlapAI-Bird_Poster.png
│   │       ├── DeepNaniNet_Demo.png
│   │       ├── FLOP_Demo1.png
│   │       ├── FLOP_Demo2.jpg
│   │       ├── FLOP_Demo3.jpg
│   │       ├── MangaNet_Demo.jpg
│   │       ├── CS142_Demo4.gif
│   │       ├── JPMorganChase_Demo.gif
│   │       ├── Shiptivitas_Demo.gif
│   │       ├── 2048_Demo.gif
│   │       └── VSSR_Demo1.jpg
│   ├── pdf/
│   │   └── resume.pdf                   # Downloadable resume
│   └── rendercv/                        # CV styling config
│       ├── design.yaml
│       ├── locale.yaml
│       └── settings.yaml
├── _sass/                               # Custom SCSS overrides (if needed)
│   └── _custom.scss
├── Gemfile                              # Ruby dependencies
├── docker-compose.yml                   # For local development
└── IMPLEMENTATION_PLAN.md
```

---

## 3. Configuration (`_config.yml`)

### 3.1 Core Site Settings

```yaml
# Site Settings
title: blank                              # blank = show first/last name instead
first_name: Tai
middle_name:
last_name: Vu
contact_note: >
  Feel free to reach out via email or connect on social media.

description: >
  Senior Machine Learning Engineer at Meta. Stanford CS. IMO Medalist.
  Building next-generation AI systems.
keywords: >
  tai vu, machine learning, AI researcher, meta, stanford,
  deep learning, reinforcement learning, NLP, computer vision

lang: en
icon: 🧠                                  # Favicon emoji

url: https://taivu1998.github.io          # GitHub Pages URL
baseurl:                                   # Empty for user pages
```

### 3.2 Navigation

```yaml
# Navigation
navbar_fixed: true
footer_fixed: false
search_enabled: true
max_width: 930px
```

Pages will include `nav: true` and `nav_order` in their frontmatter to appear in navigation.

### 3.3 Social Links

```yaml
# Social Integration — appears in footer and about page
# al-folio uses individual top-level fields (not an array):
email: taiducvu1998@gmail.com
github_username: taivu1998
linkedin_username: taiducvu
x_username: taivu1998
```

### 3.4 Feature Toggles

```yaml
enable_darkmode: true
enable_project_categories: true           # Group projects by category
enable_masonry: true                      # Masonry layout for projects
enable_math: true                         # MathJax support
enable_medium_zoom: true                  # Click-to-zoom images
enable_progressbar: true                  # Reading progress bar
lazy_loading_images: true
enable_publication_thumbnails: true

# Disable features we don't need
enable_google_analytics: false
enable_tooltips: false
enable_video_embedding: false
```

### 3.5 Collections

```yaml
collections:
  news:
    defaults:
      layout: post
    output: true
  projects:
    output: true                          # Generate individual project pages
```

### 3.6 Jekyll Scholar (Publications)

```yaml
scholar:
  last_name: [Vu]
  first_name: [Tai, T.]
  style: apa
  locale: en
  source: /_bibliography/
  bibliography: papers.bib
  bibliography_template: bib
  bibtex_filters: [latex, smallcaps, superscript]
  replace_strings: true
  join_strings: true
  details_dir: bibliography
  details_link: Details
  query: "@*"
  group_by: year
  group_order: descending
```

---

## 4. Page-by-Page Specifications

### 4.1 About Page (`_pages/about.md`) — Landing Page

**Frontmatter:**
```yaml
---
layout: about
title: about
permalink: /
subtitle: >
  Senior Machine Learning Engineer at <a href="https://about.meta.com/">Meta</a>.
  Stanford CS. IMO Medalist.
profile:
  align: right
  image: prof_pic.png
  image_circular: true
  more_info: >
    <p>Menlo Park, CA</p>
    <p>taiducvu1998@gmail.com</p>
selected_papers: true
social: true
announcements:
  enabled: true
  scrollable: true
  limit: 5
latest_posts:
  enabled: false
nav: true
nav_order: 1
---
```

**Body content (Markdown):**
```markdown
### Hello, world! Welcome to my website!

I am a Senior Machine Learning Engineer at Meta, specializing in building
and scaling next-generation AI systems. Previously, I earned my B.S. in
Computer Science from Stanford University with Highest Distinction and
engaged in cutting-edge ML research with research groups such as
Stanford AI Lab.

Beyond engineering, I have a deep passion for mathematics. I won an IMO
Medal in 2016 after securing the #1 Rank in the Vietnam Mathematical
Olympiad. I was fortunate to be endorsed by Fields Medalist Prof. Ngo
Bao Chau for my mathematical talent and research potential.

My ambition is to develop AGI capable of unlocking profound innovations
and creating lasting benefits for humanity.
```

**What al-folio renders automatically:**
- Profile photo (right-aligned, circular)
- Social icons row (email, GitHub, LinkedIn, X)
- Selected publications section (papers with `selected={true}` in BibTeX)
- News announcements section

---

### 4.2 CV Page (`_pages/cv.md`)

**Frontmatter:**
```yaml
---
layout: cv
permalink: /cv/
title: CV
nav: true
nav_order: 2
cv_pdf: /assets/pdf/resume.pdf
cv_format: rendercv
description: >
  Work experience, research, education, and achievements.
toc:
  sidebar: left
---
```

**Data source: `_data/cv.yml`** (see Section 5 for full content)

The CV page is entirely data-driven — al-folio's `layout: cv` reads from `_data/cv.yml` and renders all sections automatically with clean typography and structure.

**Sections rendered:**
1. Awards (10 items)
2. Work Experience (5 positions)
3. Research Experience (3 positions)
4. Education (Stanford)
5. Publications (10 papers)
6. Technical Skills (grouped by category)

A "Download PDF" button at the top links to the resume PDF.

---

### 4.3 Portfolio Page (`_pages/portfolio.md`) — Projects + Publications

This is a **custom combined page** that shows both the project grid and the publications list. al-folio separates these by default, but we combine them to match the user's specification.

**Frontmatter:**
```yaml
---
layout: page
title: portfolio
permalink: /portfolio/
description: Projects and publications.
nav: true
nav_order: 3
display_categories:
  - Artificial Intelligence
  - Web Development
  - App Development
  - Data Science
horizontal: false
---
```

**Body (Liquid template):**

The page body will contain two sections:

**Section A: Projects Grid**
- Uses al-folio's built-in `{% include projects.liquid %}` partial
- 3-column grid on desktop (Bootstrap `row-cols-md-3`), 1-column on mobile
- Projects grouped by category via `display_categories`
- Each card shows: thumbnail image, title, short description
- Clicking a card navigates to the project's individual page
- Projects sorted by `importance` field (lower = higher priority)

**Section B: Publications List**
- Below the projects grid, add a "Publications" heading
- Uses `{% bibliography %}` tag to auto-render from BibTeX
- Each publication rendered as a horizontal card with:
  - Paper title (bold, linked)
  - Author list (with your name highlighted)
  - Venue/year
  - Buttons: [PDF] [arXiv] [Code] [Slides] [Poster] as applicable
- Grouped by year, descending order
- Includes search bar via `{% include bib_search.liquid %}`

---

### 4.4 Individual Project Pages (`_projects/*.md`)

Each project file lives in `_projects/` and al-folio automatically generates a page for it.

**Common frontmatter structure:**
```yaml
---
layout: page
title: "Project Title"
description: "One-line description for the card"
img: assets/img/projects/ProjectDemo.png    # Card thumbnail
importance: 1                                # Sort order (1 = highest)
category: "Artificial Intelligence"          # Category grouping
github: https://github.com/taivu1998/repo   # GitHub link (optional)
paper: https://arxiv.org/abs/XXXX.XXXXX     # Paper link (optional)
poster: https://link-to-poster.pdf          # Poster link (optional)
slides: https://link-to-slides.pdf          # Slides link (optional)
---
```

**10 project pages to create:**

#### Project 1: GANime (`_projects/1_ganime.md`)
```yaml
title: "GANime: Generating Anime Characters from Sketches"
description: "Neural style transfer and GAN models for colorizing anime character sketches"
img: assets/img/projects/GANime_Demo.png
importance: 1
category: "Artificial Intelligence"
github: https://github.com/taivu1998/GANime
paper: https://arxiv.org/abs/2508.09207
poster: https://taivu1998.github.io/assets/files/projects/GANime_Poster.pdf
```
**Body**: Full description of GANime project — neural style transfer, Pix2Pix, CycleGAN models, FID score of 220.5, SSIM index of 0.76. Tech stack: Python, TensorFlow, AWS, Google Colab. Demo images with captions.

#### Project 2: FlapAI Bird (`_projects/2_flapai_bird.md`)
```yaml
title: "FlapAI Bird: Reinforcement Learning for Flappy Bird"
description: "AI agent achieving 2,000+ scores using RL techniques"
img: assets/img/projects/FlapAI-Bird_Demo.gif
importance: 2
category: "Artificial Intelligence"
github: https://github.com/taivu1998/FlapAI-Bird
paper: https://arxiv.org/abs/2003.09579
poster: https://taivu1998.github.io/assets/files/projects/FlapAI-Bird_Poster.pdf
```
**Body**: SARSA, Q-learning, function approximation, deep Q networks. Tech: Python, PyTorch, Pygame, OpenAI Gym. Team of 2, presented to 50+ students. Demo GIF.

#### Project 3: Privacy Preserving Inference (`_projects/3_privacy_preserving.md`)
```yaml
title: "Privacy Preserving Inference of Personalized Content"
description: "NLP-driven recommender system using BERT and graph neural networks"
img: assets/img/projects/DeepNaniNet_Demo.png
importance: 3
category: "Artificial Intelligence"
github: https://github.com/taivu1998/AnimeULike
paper: https://arxiv.org/abs/2508.14905
```
**Body**: BERT and graph neural networks for content embeddings, cold start generalization, privacy-preserving inference. Tech: Python, PyTorch, HuggingFace, NumPy, Pandas, Azure, Google Colab.

#### Project 4: ResNet Pruning (`_projects/4_resnet_pruning.md`)
```yaml
title: "How Not to Give a FLOP: Regularization & Pruning"
description: "15% FLOPs reduction with 2% accuracy increase via pruning"
img: assets/img/projects/FLOP_Demo1.png
importance: 4
category: "Artificial Intelligence"
github: https://github.com/taivu1998/ResNet-Regularization-Pruning
paper: https://arxiv.org/abs/2003.13593
```
**Body**: Soft filter pruning + mixup and cutout regularization on ResNet. Team of 3. Tech: PyTorch Lightning, Weights and Biases. Presented to 4 professors and 40+ students.

#### Project 5: Manga Detection (`_projects/5_manga_detection.md`)
```yaml
title: "Beyond the Panels: Manga Object Detection"
description: "FasterR-CNN, RetinaNet, and YOLOv3 for manga page analysis"
img: assets/img/projects/MangaNet_Demo.jpg
importance: 5
category: "Artificial Intelligence"
github: https://github.com/taivu1998/MangaObjectDetection
paper: https://taivu1998.github.io/assets/files/projects/MangaNet_Paper.pdf
slides: https://taivu1998.github.io/assets/files/projects/MangaNet_Slides.pdf
```
**Body**: Object detection models for manga pages, mAP score of 71.0. Tech: Python, PyTorch, NumPy, Pandas, Google Colab.

#### Project 6: Photo Sharing App (`_projects/6_photo_sharing.md`)
```yaml
title: "Photo Sharing Web Application"
description: "Full-stack photo sharing app with auth, profiles, and activity feeds"
img: assets/img/projects/CS142_Demo4.gif
importance: 6
category: "Web Development"
```
**Body**: User authentication, profiles, photo sharing, favorites, comments, activity feeds. MVC pattern. Tech: JavaScript, React, HTML, CSS, Express.js, MongoDB, Node.js.

#### Project 7: Stock Charts (`_projects/7_stock_charts.md`)
```yaml
title: "Stock Charts for Traders"
description: "JPMorgan Chase interactive stock data visualization dashboard"
img: assets/img/projects/JPMorganChase_Demo.gif
importance: 7
category: "Web Development"
github: https://github.com/taivu1998/StockViz-Trading
```
**Body**: JPMorgan Chase Software Engineering Virtual Internship. Interactive dashboard tracking stock data. Tech: Python, TypeScript, React, Perspective framework.

#### Project 8: Shiptivitas (`_projects/8_shiptivitas.md`)
```yaml
title: "Shiptivitas To Do App"
description: "Y Combinator startup program kanban-style shipping board"
img: assets/img/projects/Shiptivitas_Demo.gif
importance: 8
category: "Web Development"
github: https://github.com/taivu1998/Shiptivitas-To-Do-App
```
**Body**: Y Combinator "Train to Work at a YC Startup" program. Kanban board for freight shippers. Tech: JavaScript, React, Node.js, SQLite3, HTML, CSS.

#### Project 9: Game 2048 (`_projects/9_game_2048.md`)
```yaml
title: "Game 2048"
description: "Interactive implementation of the 2048 puzzle game"
img: assets/img/projects/2048_Demo.gif
importance: 9
category: "App Development"
github: https://github.com/taivu1998/Game-2048
```
**Body**: Simple interactive 2048 game. Tech: Java.

#### Project 10: Exchange Rates (`_projects/10_exchange_rates.md`)
```yaml
title: "Modeling Exchange Rates During Thailand's Crisis"
description: "Econometric analysis of exchange rates and capital outflows"
img: assets/img/projects/VSSR_Demo1.jpg
importance: 10
category: "Data Science"
slides: https://taivu1998.github.io/assets/files/projects/VSSR_Slides.pdf
```
**Body**: Team of 5 at Vietnam Summer School in Research. Statistical analysis, data visualization, vector autoregression. Tech: Python, R, Stata. Presented to 4 instructors and 50+ students.

---

### 4.5 Contact Page (`_pages/contact.md`) — Custom Page

al-folio doesn't include a contact page by default, so we create one using the standard `layout: page`.

**Frontmatter:**
```yaml
---
layout: page
title: contact
permalink: /contact/
description: Get in touch.
nav: true
nav_order: 4
---
```

**Body content:**
```markdown
Thank you for visiting my website. Feel free to reach out to me
using the following contact information.

**Email**: [taiducvu1998@gmail.com](mailto:taiducvu1998@gmail.com)

**LinkedIn**: [linkedin.com/in/taiducvu](https://linkedin.com/in/taiducvu)

**GitHub**: [github.com/taivu1998](https://github.com/taivu1998)

**X (Twitter)**: [twitter.com/taivu1998](https://twitter.com/taivu1998)

---

📄 [Download my resume](/assets/pdf/resume.pdf)
```

The footer (rendered by al-folio on all pages) will also include the social icon links configured in `_config.yml`.

---

## 5. CV Data (`_data/cv.yml`)

The complete CV in RenderCV YAML format:

```yaml
cv:
  name: "Tai Vu"
  label: "Senior Machine Learning Engineer"
  email: "taiducvu1998@gmail.com"
  location: "Menlo Park, CA, USA"
  image: "prof_pic.png"
  summary: >
    Senior Machine Learning Engineer at Meta, specializing in building
    and scaling next-generation AI systems. Stanford CS graduate with
    Highest Distinction. IMO Medalist.

  social_networks:
    - network: GitHub
      username: taivu1998
    - network: LinkedIn
      username: taiducvu
    - network: X
      username: taivu1998

  sections:
    awards:
      - title: "Bronze Medal, International Mathematical Olympiad"
        date: 2016
        awarder: "IMO"
      - title: "Gold Medal, Vietnamese Mathematical Olympiad (Rank #1)"
        date: 2016
        awarder: "VMO"
      - title: "Gold Medal, American Mathematics Competition"
        date: 2016
        awarder: "AMC"
      - title: "Gold Medal, International Mathematics Local Tournament"
        date: 2015
        awarder: "IMLT"
      - title: "Silver Medal, Vietnamese Mathematical Olympiad (Rank #2)"
        date: 2015
        awarder: "VMO"
      - title: "Gold Medal, Regional Mathematics Competition"
        date: 2015
        awarder: "Regional"
      - title: "Gold Medal, Nam Dinh Province Mathematics Competition"
        date: 2015
        awarder: "Provincial"
      - title: "Gold Medal, High School for Gifted Students Olympiad"
        date: 2015
        awarder: "HSGS"
      - title: "Gold Medal, Hanoi Open Mathematics Competition"
        date: 2014
        awarder: "HOMC"
      - title: "Scholarship, National Program for Development of Mathematics"
        date: 2014
        awarder: "Vietnam National Program"

    experience:
      - company: "Meta Platforms"
        position: "Senior Machine Learning Engineer"
        location: "Menlo Park, CA, USA"
        start_date: "2022-07"
        end_date: "present"
        summary: ""
        highlights:
          - "Building large-scale end-to-end ML-powered recommender systems."
          - "Developing state-of-the-art ML techniques, including causal inference, model scaling and efficiency, knowledge distillation, sequence modeling, dynamic user interest modeling, contextual and multimodal representation learning, value-aware multi-objective learning, and data denoising."
          - "Researching next-gen ML technologies, including LLMs, RL, reward modeling, agentic recommendations, and content quality & safety alignment."

      - company: "Meta Platforms"
        position: "Software Engineering Intern"
        location: "Menlo Park, CA, USA"
        start_date: "2021-06"
        end_date: "2021-09"
        summary: ""
        highlights:
          - "Worked on the Facebook Commerce Monetization team."
          - "Developed large-scale ML models in PyTorch to generate contextual embeddings of users and ads, enhancing semantic understanding and fine-grained personalization in ad retrieval and ranking systems."
          - "Designed and deployed representation learning frameworks for user-ad matching across multiple surfaces, significantly improving relevance and driving ad revenue growth."

      - company: "Meta Platforms"
        position: "Software Engineering Intern"
        location: "Menlo Park, CA, USA"
        start_date: "2020-06"
        end_date: "2020-09"
        summary: ""
        highlights:
          - "Worked on the AI Mobile Platform team, contributing to the development of the PyTorch platform."
          - "Enhanced latency profiling tools with module-level debugging. Achieved a 5x increase in runtime efficiency."
          - "Accelerated Conv1D and channel shuffle operations through low-level kernel optimizations for the PyTorch framework, delivering up to 10x operator-level speedup for on-device speech and NLP models."

      - company: "Vietnam Posts and Telecommunications Group"
        position: "Software Engineering Intern"
        location: "Hanoi, Vietnam"
        start_date: "2019-06"
        end_date: "2019-08"
        summary: ""
        highlights:
          - "Developed deep learning and computer vision models to extract texts, numbers, and logos from images of bank cards, achieving 89% accuracy."
          - "Embedded the models in iOS and Android apps, improving the experience of 40,000 users."

      - company: "ViCare Corporation"
        position: "Data Analytics Intern"
        location: "Hanoi, Vietnam"
        start_date: "2017-05"
        end_date: "2017-07"
        summary: ""
        highlights:
          - "Analyzed daily statistical data of 2 million customers, assisting managers in sales and marketing decisions."
          - "Developed tools to automate data cleaning, analysis, and visualization, speeding up the data analytics pipeline by 10x."

    # Research Experience
    # Note: al-folio's RenderCV renders section keys as headings.
    # Using "volunteer" would display "Volunteer" as the heading.
    # Instead, we add research positions directly under "experience"
    # above (clearly distinguishable by company/org name), OR we
    # verify during implementation whether al-folio's cv.yml
    # supports custom section keys like "research" that render
    # with the correct heading. If not, these entries should be
    # merged into the "experience" section above.
    #
    # For now, listing under "volunteer" as a placeholder —
    # must be tested and adjusted during local preview.

    volunteer:
      - organization: "Stanford AI Lab"
        position: "Undergraduate Researcher"
        location: "Stanford, CA, USA"
        start_date: "2020-04"
        end_date: "2021-09"
        summary: >
          Stanford Machine Learning Group under Prof. Andrew Ng's supervision.
        highlights:
          - "Built large-scale data pipelines to ingest, align, and preprocess satellite imagery and global forest loss driver labels."
          - "Designed and trained deep learning models (CNNs, LSTMs, multimodal fusion) to classify forest loss drivers from multi-temporal satellite imagery, achieving 80% classification accuracy."

      - organization: "Stanford InfoLab"
        position: "Undergraduate Researcher"
        location: "Stanford, CA, USA"
        start_date: "2020-02"
        end_date: "2020-04"
        summary: ""
        highlights:
          - "Engineered a high-throughput input pipeline for loading and preprocessing underwater video data."
          - "Developed Mask R-CNN and U-Net models in TensorFlow to detect, localize, and temporally track coral structures in underwater environments."

      - organization: "Computer Science Research Lab"
        position: "Undergraduate Researcher"
        location: "Stanford, CA, USA"
        start_date: "2019-09"
        end_date: "2019-12"
        summary: ""
        highlights:
          - "Researched model compression techniques, including structured pruning, regularization-based sparsity, and weight quantization."
          - "Applied regularization and pruning strategies to ResNet, achieving a 15% reduction in FLOPs with a 2% improvement in accuracy."

    education:
      - institution: "Stanford University"
        location: "Stanford, CA, USA"
        area: "Computer Science (AI Specialization)"
        studyType: "B.S."
        start_date: 2018
        end_date: 2022
        score: "GPA: 4.18/4.0"
        highlights:
          - "Graduated with Distinction (Summa Cum Laude)."
          - "CS Coursework: Machine Learning, Deep Learning, NLP, LLMs, Reinforcement Learning, Computer Vision, NLU, Data Mining, ML with Graphs, Algorithms, Parallel Computing."
          - "Math Coursework: Linear Algebra, Probability & Statistics, Convex Optimization, Real Analysis, Graph Theory."

    skills:
      - name: "Languages"
        keywords:
          - "Python"
          - "C"
          - "C++"
          - "JavaScript"
          - "TypeScript"
          - "Java"
          - "SQL"
          - "PHP"
          - "R"
          - "MATLAB"
      - name: "AI/ML"
        keywords:
          - "PyTorch"
          - "TensorFlow"
          - "Keras"
          - "HuggingFace"
          - "Scikit-learn"
          - "OpenCV"
          - "NLTK"
          - "SpaCy"
          - "Detectron2"
          - "FastAI"
          - "XGBoost"
      - name: "Data & Analytics"
        keywords:
          - "NumPy"
          - "Pandas"
          - "Spark"
          - "Matplotlib"
          - "Seaborn"
          - "SciPy"
          - "D3.js"
          - "Tableau"
      - name: "Web Development"
        keywords:
          - "React"
          - "Node.js"
          - "Express.js"
          - "MongoDB"
          - "Next.js"
          - "Django"
          - "HTML"
          - "CSS"
      - name: "Cloud & DevOps"
        keywords:
          - "AWS"
          - "GCP"
          - "Azure"
          - "Heroku"
          - "Git"
          - "Linux"
          - "Docker"

    languages:
      - language: "English"
        fluency: "Professional"
      - language: "Vietnamese"
        fluency: "Native"
```

---

## 6. Publications (`_bibliography/papers.bib`)

**Note on `preview` images:** al-folio looks for publication preview
images in `assets/img/publication_preview/` by default. During
implementation, either place copies there or verify al-folio's
configured preview path and adjust accordingly.

### 6.1 Real Publications (10 entries)

```bibtex
@article{vu2020flapai,
  abbr      = {arXiv},
  title     = {FlapAI Bird: Training an Agent to Play Flappy Bird
               Using Reinforcement Learning Techniques},
  author    = {Vu, Tai and Tran, Leon},
  journal   = {arXiv preprint arXiv:2003.09579},
  year      = {2020},
  arxiv     = {2003.09579},
  code      = {https://github.com/taivu1998/FlapAI-Bird},
  selected  = {true},
  preview   = {FlapAI-Bird_Demo.gif}
}

@article{vu2020flop,
  abbr      = {arXiv},
  title     = {How Not to Give a FLOP: Combining Regularization
               and Pruning for Efficient Inference},
  author    = {Vu, Tai and Mehta, Riya and Yak, Scott},
  journal   = {arXiv preprint arXiv:2003.13593},
  year      = {2020},
  arxiv     = {2003.13593},
  code      = {https://github.com/taivu1998/ResNet-Regularization-Pruning},
  selected  = {true},
  preview   = {FLOP_Demo1.png}
}

@article{vu2025privacy,
  abbr      = {arXiv},
  title     = {Privacy Preserving Inference of Personalized Content
               for Out of Matrix Users},
  author    = {Vu, Tai and Others},
  journal   = {arXiv preprint arXiv:2508.14905},
  year      = {2025},
  arxiv     = {2508.14905},
  code      = {https://github.com/taivu1998/AnimeULike},
  selected  = {true}
}

@article{vu2025ganime,
  abbr      = {arXiv},
  title     = {GANime: Generating Anime and Manga Character Drawings
               from Sketches with Deep Learning},
  author    = {Vu, Tai and Others},
  journal   = {arXiv preprint arXiv:2508.09207},
  year      = {2025},
  arxiv     = {2508.09207},
  code      = {https://github.com/taivu1998/GANime},
  selected  = {true},
  preview   = {GANime_Demo.png}
}

@article{vu2025bertvqa,
  abbr      = {arXiv},
  title     = {BERT-VQA: Visual Question Answering on Plots},
  author    = {Vu, Tai and Others},
  journal   = {arXiv preprint arXiv:2508.13184},
  year      = {2025},
  arxiv     = {2508.13184},
  code      = {https://github.com/taivu1998/BERT-VQA}
}

@article{vu2020pixelcopter,
  abbr      = {Paper},
  title     = {Pixel-Perfect Piloting: Superhuman Control of Pixelcopter
               via Reinforcement Learning},
  author    = {Vu, Tai},
  year      = {2020},
  pdf       = {https://taivu1998.github.io/assets/files/projects/PixelcopterRL_Paper.pdf},
  code      = {https://github.com/taivu1998/Pixelcopter-RL}
}

@article{vu2020manga,
  abbr      = {Paper},
  title     = {Beyond the Panels: A Deep Neural Network Approach
               for Manga Object Detection},
  author    = {Vu, Tai},
  year      = {2020},
  pdf       = {https://taivu1998.github.io/assets/files/projects/MangaNet_Paper.pdf},
  code      = {https://github.com/taivu1998/MangaObjectDetection},
  preview   = {MangaNet_Demo.jpg}
}

@article{vu2020deepemonet,
  abbr      = {Paper},
  title     = {Amplifying Emotional Signals: Data-Efficient Deep Learning
               for Robust Speech Emotion Recognition},
  author    = {Vu, Tai and Others},
  year      = {2020},
  pdf       = {https://taivu1998.github.io/assets/files/projects/DeepEmoNet_Paper.pdf},
  code      = {https://github.com/taivu1998/ML-SER}
}

@article{vu2020intentbot,
  abbr      = {Paper},
  title     = {From Bayes to BERT: A Comprehensive Benchmark for
               State-of-the-Art Intent Detection},
  author    = {Vu, Tai and Yang, Bob and Others},
  year      = {2020},
  pdf       = {https://taivu1998.github.io/assets/files/projects/IntentBot_Paper.pdf},
  code      = {https://github.com/bobyang9/NLU-for-Intent-Classification}
}

@misc{vu2020connaisseur,
  abbr      = {Project},
  title     = {ConnAIsseur: An AI-driven Recipe Recommendation Website},
  author    = {Vu, Tai and Others},
  year      = {2020},
  code      = {https://github.com/taivu1998/ConnAIsseur}
}
```

### 6.2 Placeholder Publications (3 entries)

```bibtex
@article{vu2026placeholder1,
  abbr      = {NeurIPS},
  title     = {Scaling Agentic Recommendations with Reinforcement
               Learning from Human Feedback},
  author    = {Vu, Tai and Others},
  journal   = {Advances in Neural Information Processing Systems},
  year      = {2026},
  abstract  = {Coming soon.},
  note      = {Placeholder — paper in progress}
}

@article{vu2026placeholder2,
  abbr      = {ICML},
  title     = {Causal Inference for Large-Scale Multi-Objective
               Recommender Systems},
  author    = {Vu, Tai and Others},
  journal   = {International Conference on Machine Learning},
  year      = {2026},
  abstract  = {Coming soon.},
  note      = {Placeholder — paper in progress}
}

@article{vu2026placeholder3,
  abbr      = {ICLR},
  title     = {Efficient Knowledge Distillation in
               Billion-Parameter Language Models},
  author    = {Vu, Tai and Others},
  journal   = {International Conference on Learning Representations},
  year      = {2026},
  abstract  = {Coming soon.},
  note      = {Placeholder — paper in progress}
}
```

---

## 7. Image Assets

### 7.1 Images to Download from Existing Site

All images will be downloaded from the current `taivu1998.github.io` and placed in `assets/img/`:

| Source URL | Destination |
|-----------|-------------|
| `.../profile/about.png` | `assets/img/prof_pic.png` |
| `.../projects/GANime_Demo.png` | `assets/img/projects/GANime_Demo.png` |
| `.../projects/GANime_Poster.png` | `assets/img/projects/GANime_Poster.png` |
| `.../projects/FlapAI-Bird_Demo.gif` | `assets/img/projects/FlapAI-Bird_Demo.gif` |
| `.../projects/FlapAI-Bird_Poster.png` | `assets/img/projects/FlapAI-Bird_Poster.png` |
| `.../projects/DeepNaniNet_Demo.png` | `assets/img/projects/DeepNaniNet_Demo.png` |
| `.../projects/FLOP_Demo1.png` | `assets/img/projects/FLOP_Demo1.png` |
| `.../projects/FLOP_Demo2.jpg` | `assets/img/projects/FLOP_Demo2.jpg` |
| `.../projects/FLOP_Demo3.jpg` | `assets/img/projects/FLOP_Demo3.jpg` |
| `.../projects/MangaNet_Demo.jpg` | `assets/img/projects/MangaNet_Demo.jpg` |
| `.../projects/CS142_Demo4.gif` | `assets/img/projects/CS142_Demo4.gif` |
| `.../projects/JPMorganChase_Demo.gif` | `assets/img/projects/JPMorganChase_Demo.gif` |
| `.../projects/Shiptivitas_Demo.gif` | `assets/img/projects/Shiptivitas_Demo.gif` |
| `.../projects/2048_Demo.gif` | `assets/img/projects/2048_Demo.gif` |
| `.../projects/VSSR_Demo1.jpg` | `assets/img/projects/VSSR_Demo1.jpg` |

### 7.2 PDF Assets

| Source URL | Destination |
|-----------|-------------|
| `.../profile/updated_resume.pdf` | `assets/pdf/resume.pdf` |

---

## 8. News Items (`_news/`)

Add 1-2 news items to display on the About page:

**`_news/announcement_1.md`:**
```yaml
---
layout: post
date: 2025-01-01
inline: true
related_posts: false
---

Welcome to my new personal website! I'm excited to share my work
in AI research and engineering. Feel free to explore my projects,
publications, and experience.
```

---

## 9. Customizations Beyond Default al-folio

### 9.1 Combined Portfolio Page

al-folio separates projects and publications into different pages. We need to create a **custom portfolio page** that combines both. This requires modifying `_pages/portfolio.md` to include both the project grid (via Liquid template) and the bibliography (via `{% bibliography %}`).

The Liquid template code will:
1. Render the project cards grid (using `{% include projects.liquid %}`)
2. Add a divider
3. Render a "Publications" heading
4. Include `{% include bib_search.liquid %}` for search
5. Render `{% bibliography %}` for the full publication list

### 9.2 Contact Page

Create a new `_pages/contact.md` with `layout: page`. This is a simple Markdown page — no special layout needed.

### 9.3 Remove Unused Default Pages

Remove or disable these default al-folio pages that aren't needed:
- `_pages/blog.md` — not needed (set `nav: false` or delete)
- `_pages/repositories.md` — not needed
- `_pages/teaching.md` — not needed
- `_pages/publications.md` — replaced by portfolio page
- `_pages/projects.md` — replaced by portfolio page

### 9.4 Footer Social Links

al-folio's footer automatically renders social icons based on `_config.yml` settings. Ensure the following are configured:
- `email` → Gmail icon
- `github_username` → GitHub icon
- `linkedin_username` → LinkedIn icon
- `x_username` → X/Twitter icon

### 9.5 Light/Dark Theme Colors (Optional)

If customizing the default theme colors, edit `_sass/_themes.scss`:
- Keep the default al-folio color scheme (clean and professional), or
- Customize accent color to differentiate from other al-folio sites

---

## 10. Development & Deployment Workflow

### Strategy: Develop Locally, Old Site Stays Live, Then Swap

The new site is built entirely in a local folder (`Personal_Website/`).
The old site at `https://taivu1998.github.io` remains live and untouched
throughout development. Only when the new site is verified and ready do
we swap it into the live repo.

```
┌─────────────────────────────────────────────────────────┐
│  DEVELOPMENT (local)         PRODUCTION (GitHub Pages)  │
│                                                         │
│  Personal_Website/           taivu1998.github.io repo   │
│  ├── al-folio files          ├── old Jekyll site        │
│  ├── customize & edit        │   (untouched, live)      │
│  └── preview localhost:8080  │                          │
│           │                           │                 │
│           │    ── swap when ready ──▶  │                 │
│           ▼                           ▼                 │
│  localhost:8080              taivu1998.github.io        │
│  (new site preview)          (new site goes live)       │
└─────────────────────────────────────────────────────────┘
```

---

## 11. Implementation Phases

### Phase 1: Setup & Scaffold (Steps 1-4)

| Step | Action | Details |
|------|--------|---------|
| 1 | Download al-folio template into `Personal_Website/` | Clone to temp, copy files in, init fresh git (see Section 12 for exact commands) |
| 2 | Configure `_config.yml` (site info, social links, scholar, features) | Set `url: https://taivu1998.github.io`, `baseurl:` empty |
| 3 | Download all image assets from existing site | Save to `assets/img/` |
| 4 | Download resume PDF | Save to `assets/pdf/resume.pdf` |

### Phase 2: Core Content (Steps 5-8)

| Step | Action | Files |
|------|--------|-------|
| 5 | Write About page with bio and profile | `_pages/about.md` |
| 6 | Write CV data in RenderCV format | `_data/cv.yml` |
| 7 | Create CV page with PDF link | `_pages/cv.md` |
| 8 | Add news items | `_news/announcement_1.md` |

### Phase 3: Projects & Publications (Steps 9-12)

| Step | Action | Files |
|------|--------|-------|
| 9 | Create all 10 project files with full content | `_projects/*.md` (10 files) |
| 10 | Add all publications to BibTeX file | `_bibliography/papers.bib` |
| 11 | Build combined Portfolio page (projects + publications) | `_pages/portfolio.md` |
| 12 | Create Contact page | `_pages/contact.md` |

### Phase 4: Local Testing (Steps 13-15)

| Step | Action | Details |
|------|--------|---------|
| 13 | Remove unused default pages (blog, repos, teaching) | `_pages/` cleanup |
| 14 | Start local server and preview | `docker compose up` → `localhost:8080` |
| 15 | Verify all pages, links, responsive design, dark mode | Manual QA |

### Phase 5: Deploy — Swap Into Live Repo (Steps 16-20)

| Step | Action | Command |
|------|--------|---------|
| 16 | Clone the live repo to a temp directory | `rm -rf /tmp/taivu1998.github.io && git clone https://github.com/taivu1998/taivu1998.github.io.git /tmp/taivu1998.github.io` |
| 17 | Create a backup branch to preserve the old site | `cd /tmp/taivu1998.github.io && git checkout -b archive/old-site && git push origin archive/old-site` |
| 18 | Switch back to main, remove old files | `git checkout main && git rm -rf .` |
| 19 | Copy new site files in (excluding `.git`) and commit | `rsync -a --exclude='.git' --exclude='.claude' --exclude='IMPLEMENTATION_PLAN.md' /Users/vuductai/Documents/Projects/Personal_Website/ . && git add . && git commit -m "Redesign site with al-folio template"` |
| 20 | Push to main — GitHub Actions auto-deploys | `git push origin main` |

---

## 12. Local Development

### Initial Setup (Step 1)

```bash
cd /Users/vuductai/Documents/Projects/Personal_Website

# Clone al-folio to a temp folder (avoids conflict with existing files)
rm -rf /tmp/al-folio
git clone --depth 1 https://github.com/alshedivat/al-folio.git /tmp/al-folio

# Copy template files into Personal_Website (excluding al-folio's .git)
rsync -a --exclude='.git' /tmp/al-folio/ .

# Clean up temp folder
rm -rf /tmp/al-folio

# Initialize a fresh git repo for local version control
git init
```

### Preview with Docker (Recommended)

```bash
cd /Users/vuductai/Documents/Projects/Personal_Website

# Pull and start local server
docker compose pull
docker compose up

# Site available at http://localhost:8080
# Hot-reloads on file changes — edit and refresh to see updates
```

### Preview without Docker

```bash
cd /Users/vuductai/Documents/Projects/Personal_Website

# Install dependencies
bundle install
pip install jupyter

# Start local server
bundle exec jekyll serve

# Site available at http://localhost:4000
```

### Stopping the Server

```bash
# Docker: Ctrl+C in the terminal, or:
docker compose down

# Non-Docker: Ctrl+C in the terminal
```

---

## 13. Deployment

### Pre-Deployment Checklist

Run through this before executing Phase 5:

- [ ] All 4 pages render correctly at `localhost:8080`
- [ ] About page: profile photo, bio, social icons, selected publications
- [ ] CV page: all sections (awards, experience, research, education, skills)
- [ ] Portfolio page: project cards grid + publications list
- [ ] Contact page: all links work
- [ ] All 10 project detail pages load with images
- [ ] Publications render correctly from BibTeX
- [ ] Footer shows Gmail, LinkedIn, GitHub, X icons on all pages
- [ ] Mobile responsiveness verified (resize browser to 375px width)
- [ ] Dark mode toggle works
- [ ] `_config.yml` has `url: https://taivu1998.github.io`
- [ ] `_config.yml` has `baseurl:` (empty)

### Pre-Deployment: Configure GitHub Repo Settings (do this BEFORE pushing)

1. Go to repo **Settings → Actions → General → Workflow permissions**
2. Set to **"Read and write permissions"**
3. This ensures the al-folio deploy workflow can write to the `gh-pages` branch on first push

### Deployment Commands (Phase 5, all in sequence)

```bash
# Step 16: Clone live repo to temp directory
rm -rf /tmp/taivu1998.github.io
git clone https://github.com/taivu1998/taivu1998.github.io.git /tmp/taivu1998.github.io

# Step 17: Preserve old site in a backup branch
cd /tmp/taivu1998.github.io
git checkout -b archive/old-site
git push origin archive/old-site

# Step 18: Switch to main and clear old files
git checkout main
git rm -rf .

# Step 19: Copy in new site (excluding .git, .claude, and plan file)
rsync -a --exclude='.git' --exclude='.claude' --exclude='IMPLEMENTATION_PLAN.md' \
  /Users/vuductai/Documents/Projects/Personal_Website/ .
git add .
git commit -m "Redesign site with al-folio template"

# Step 20: Push — site goes live in ~2 minutes
git push origin main
```

### Post-Deployment

1. Go to **Settings → Pages**
2. Set source to **`gh-pages` branch** (created automatically by GitHub Actions)
3. Wait for the Deploy action to complete (~2 minutes)
4. Verify at `https://taivu1998.github.io`

### Rollback (if needed)

```bash
# Option A: If /tmp/taivu1998.github.io still exists (same session)
cd /tmp/taivu1998.github.io
git reset --hard archive/old-site
git push --force origin main

# Option B: If /tmp was cleaned (e.g., after reboot) — re-clone from remote
rm -rf /tmp/taivu1998.github.io
git clone https://github.com/taivu1998/taivu1998.github.io.git /tmp/taivu1998.github.io
cd /tmp/taivu1998.github.io
git reset --hard origin/archive/old-site
git push --force origin main

# Either way, old site is restored at taivu1998.github.io within ~2 minutes
```

---

## 14. Total Deliverables

| Item | Count | Details |
|------|-------|---------|
| Configuration files | 2 | `_config.yml`, `_data/repositories.yml` |
| Page files | 4 | about, cv, portfolio, contact |
| Project files | 10 | Individual project pages |
| CV data file | 1 | `_data/cv.yml` |
| BibTeX file | 1 | 13 publication entries |
| News files | 1 | Welcome announcement |
| Image assets | ~15 | Profile photo + project images |
| PDF assets | 1 | Resume |
| **Total files to create/edit** | **~35** | |

---

## 15. Key Advantages of This Approach

| vs. Building from Scratch | vs. Other Templates |
|---------------------------|---------------------|
| 10x less code to write | BibTeX auto-parsing (unique to al-folio) |
| Battle-tested responsive design | Used by top AI researchers |
| Built-in dark/light mode | Active community (15k+ stars) |
| SEO, accessibility, performance baked in | RenderCV for PDF generation |
| GitHub Actions auto-deploy | CMU, NeurIPS, ICLR trust it |
| Zero JS frameworks to maintain | Instant credibility with reviewers |
