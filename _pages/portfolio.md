---
layout: page
title: Portfolio
permalink: /portfolio/
description:
nav: true
nav_order: 3
display_categories:
  - Artificial Intelligence
  - Web & App Development
horizontal: false
---

<div style="margin-top: 2rem;"></div>

## Projects

<div class="projects">
{% if site.enable_project_categories and page.display_categories %}
  {% for category in page.display_categories %}
  <a id="{{ category }}" href=".#{{ category }}">
    <h2 class="category">{{ category }}</h2>
  </a>
  {% assign categorized_projects = site.projects | where: "category", category %}
  {% assign sorted_projects = categorized_projects | sort: "importance" %}
  {% if page.horizontal %}
  <div class="container">
    <div class="row row-cols-1 row-cols-md-2">
    {% for project in sorted_projects %}
      {% include projects_horizontal.liquid %}
    {% endfor %}
    </div>
  </div>
  {% else %}
  <div class="row row-cols-1 row-cols-md-3">
    {% for project in sorted_projects %}
      {% include projects.liquid %}
    {% endfor %}
  </div>
  {% endif %}
  {% endfor %}
{% else %}
  {% assign sorted_projects = site.projects | sort: "importance" %}
  {% if page.horizontal %}
  <div class="container">
    <div class="row row-cols-1 row-cols-md-2">
    {% for project in sorted_projects %}
      {% include projects_horizontal.liquid %}
    {% endfor %}
    </div>
  </div>
  {% else %}
  <div class="row row-cols-1 row-cols-md-3">
    {% for project in sorted_projects %}
      {% include projects.liquid %}
    {% endfor %}
  </div>
  {% endif %}
{% endif %}
</div>

<div style="margin-top: 6rem;"></div>

---

<!-- Publications Section -->

## Publications

<div class="publications">
  {% bibliography --group_by none %}
</div>

<div style="margin-top: 6rem;"></div>

---

<!-- Open-Source Contributions Section -->

## Open-Source Contributions

<style>
  .oss-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 12px;
    margin-top: 1.5rem;
  }
  .oss-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border: 1px solid var(--global-divider-color);
    border-radius: 8px;
    background-color: var(--global-card-bg-color);
    color: var(--global-text-color);
    text-decoration: none;
    transition: all 0.2s ease-in-out;
  }
  .oss-card:hover {
    border-color: var(--global-theme-color);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
  .oss-card i {
    font-size: 1.4rem;
    color: var(--global-theme-color);
    flex-shrink: 0;
  }
  .oss-card .oss-name {
    font-size: 0.95rem;
    line-height: 1.3;
    word-break: break-word;
  }
  .oss-card .oss-owner {
    color: var(--global-text-color-light);
  }
  .oss-card .oss-stars {
    margin-left: auto;
    flex-shrink: 0;
    height: 20px;
  }
</style>

<div class="oss-grid">
{% for repo in site.data.repositories.contributed_repos %}
  {% assign parts = repo | split: "/" %}
  <a class="oss-card" href="https://github.com/{{ repo }}" target="_blank" rel="noopener noreferrer">
    <i class="fa-brands fa-github"></i>
    <span class="oss-name"><span class="oss-owner">{{ parts[0] }}/</span>{{ parts[1] }}</span>
    <img class="oss-stars" src="https://img.shields.io/github/stars/{{ repo }}?style=flat&amp;label=%E2%98%85&amp;labelColor=3b3b3b&amp;color=2698ba" alt="{{ repo }} stars" loading="lazy" />
  </a>
{% endfor %}
</div>
