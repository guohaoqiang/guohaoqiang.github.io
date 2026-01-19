"""
Static blog generator.

- Reads Markdown files from `posts/*.md`.
- Converts each to HTML using `markdown` (python-markdown) with fenced_code extension so code blocks get language classes.
- Writes `posts/<slug>.html` (wrapped in a simple template that includes highlight.js).
- Writes `posts/posts.json` with metadata (title, date, slug, excerpt).

Usage:
    pip install markdown
    python generate_posts.py

"""
import os
import json
import re
from datetime import datetime
import markdown
import urllib.parse
from PIL import Image

POSTS_DIR = 'posts'
OUT_DIR = 'posts'
ASSETS_DIR = 'assets'

TEMPLATE = '''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>{title}</title>
  
  <script>
    window.MathJax = {{ tex: {{ inlineMath: [['$', '$']], displayMath: [['$$', '$$']] }} }};
  </script>
  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>

  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github.min.css">
  
  <style>
    :root {{ --text: #2c3e50; --accent: #3498db; }}
    body {{
      font-family: "Charter", "Georgia", serif;
      line-height: 1.8;
      color: var(--text);
      max-width: 820px;
      margin: 0 auto;
      padding: 40px 20px;
      scroll-behavior: smooth;
    }}

    .site-header {{
      max-width: 820px;
      margin: 0 auto;
      padding: 40px 20px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1px solid var(--border);
    }}
    .header-left {{ display: flex; align-items: center; gap: 15px; text-decoration: none; color: var(--text); }}
    .avatar {{ width: 50px; height: 50px; border-radius: 6px; object-fit: cover; }}
    .site-title {{ font-family: sans-serif; font-size: 24px; font-weight: 700; }}
    
    .nav-links {{ font-family: sans-serif; font-size: 16px; }}
    .nav-links a {{ margin-left: 20px; color: #666; text-decoration: none; }}
    .nav-links a:hover {{ color: var(--accent); }}

    h1, h2, h3 {{ font-family: -apple-system, sans-serif; margin-top: 1.6em; }}
    .meta {{ font-family: sans-serif; color: #666; font-size: 0.9em; margin-bottom: 20px; }}
    
    /* Intro/Excerpt block */
    .excerpt {{
      font-size: 1.2em;
      color: #546e7a;
      border-left: 4px solid var(--accent);
      padding-left: 20px;
      margin: 30px 0;
      font-style: italic;
    }}

    /* Table of Contents styling */
    .toc {{
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      font-family: sans-serif;
      font-size: 0.9em;
    }}
    .toc ul {{ list-style: none; padding-left: 20px; }}

    /* Illustrated Content (Images/GIFs) */
    .content img {{
      max-width: 100%;
      height: auto;
      display: block;
      margin: 3rem auto;
      border-radius: 6px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }}

    /* Back to Top Button */
    #backToTop {{
      position: fixed;
      bottom: 30px;
      right: 30px;
      width: 45px;
      height: 45px;
      background: var(--text);
      color: white;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      opacity: 0.7;
      transition: opacity 0.3s;
      z-index: 1000;
    }}
    #backToTop:hover {{ opacity: 1; }}
  </style>
</head>
<body>
  <header class="site-header">
    <a href="/" class="header-left">
      <img src="/assets/avatar.jpg" alt="Haoqiang Guo" class="avatar">
      <span class="site-title">Haoqiang Guo</span>
    </a>
    <nav class="nav-links">
      <a href="/#blog">Blog</a>
      <a href="mailto:hqguo1116@gmail.com?subject=Question regarding: {title_encoded}">Contact</a>
    </nav>
  </header>

  <article>
    <h1>{title}</h1>
    <div class="meta">Published on {date}</div>
    
    <div class="excerpt">{excerpt}</div>

    <div class="content">
      {content}
    </div>
  </article>
  
  <button id="backToTop" title="Go to top">↑</button>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
  <script>
    hljs.highlightAll();

    // BACK TO TOP LOGIC
    const btt = document.getElementById("backToTop");
    window.onscroll = function() {{
      if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {{
        btt.style.display = "flex";
      }} else {{
        btt.style.display = "none";
      }}
    }};
    btt.onclick = function() {{
      window.scrollTo({{top: 0, behavior: 'smooth'}});
    }};
  </script>
</body>
</html>'''

def slugify(name):
    name = name.lower()
    name = re.sub(r'[^a-z0-9\-]+', '-', name)
    return name.strip('-')

def parse_md_metadata(text, filename):
    lines = text.splitlines()
    title = next((ln.strip()[2:] for ln in lines if ln.startswith('# ')), os.path.splitext(filename)[0])
    
    m = re.match(r'(\d{4}-\d{2}-\d{2})', os.path.basename(filename))
    date = m.group(1) if m else datetime.now().strftime('%Y-%m-%d')
    
    excerpt = ""
    found_title = False
    for ln in lines:
        if found_title and ln.strip() and not ln.startswith('#'):
            excerpt = ln.strip()
            break
        if ln.startswith('# '): found_title = True
            
    return title, date, excerpt

def optimize_assets():
    """Optimizes JPG, PNG, and animated GIFs in the assets folder."""
    if not os.path.exists(ASSETS_DIR): return
    print("--- Optimizing Assets ---")
    for filename in os.listdir(ASSETS_DIR):
        path = os.path.join(ASSETS_DIR, filename)
        if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            try:
                img = Image.open(path)
                img.save(path, optimize=True, quality=85)
                print(f"Optimized: {filename}")
            except Exception as e: print(f"Error optimizing {filename}: {e}")
        elif filename.lower().endswith('.gif'):
            # This requires 'gifsicle' installed on your Mac Studio via brew
            result = os.system(f"gifsicle -O3 --lossy=80 -i {path} -o {path}")
            if result == 0: print(f"Optimized GIF: {filename}")
            else: print(f"Skipped GIF optimization (gifsicle not found or error).")

def build():
    posts = []
    # Added 'toc' and 'extra' for the features you requested
    md = markdown.Markdown(extensions=['fenced_code', 'tables', 'extra', 'toc'])
    
    if not os.path.exists(POSTS_DIR): os.makedirs(POSTS_DIR)

    for fname in sorted(os.listdir(POSTS_DIR), reverse=True):
        if not fname.endswith('.md'): continue
        
        with open(os.path.join(POSTS_DIR, fname), 'r', encoding='utf-8') as f:
            text = f.read()
        
        title, date, excerpt = parse_md_metadata(text, fname)
        slug = os.path.splitext(fname)[0]
        
        body_text = re.sub(r'^# .*\n?', '', text, count=1, flags=re.MULTILINE)

        # Automatically inject [TOC] marker if not present to force ToC generation
        if '[TOC]' not in text:
            text = "[TOC]\n\n" + body_text
            
        html = md.convert(text)

        # LAZY LOADING OPTIMIZATION:
        # Automatically inject loading="lazy" into all <img> tags
        html = html.replace('<img ', '<img loading="lazy" ')

        title_encoded = urllib.parse.quote(title)

        # Create directory for Pretty URL
        post_dir = os.path.join(OUT_DIR, slug)
        os.makedirs(post_dir, exist_ok=True)
        
        out_html = TEMPLATE.format(title=title, title_encoded=title_encoded, date=date, excerpt=excerpt, content=html, slug=slug)
        
        with open(os.path.join(post_dir, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(out_html)
            
        posts.append({'title':title, 'date':date, 'slug':slug, 'excerpt':excerpt})
        md.reset()
        print(f'Done: {slug}/index.html')

    with open(os.path.join(OUT_DIR, 'posts.json'), 'w', encoding='utf-8') as f:
        json.dump(posts, f, indent=2)

if __name__=='__main__':
    build()
    optimize_assets()
    print("--- Build Complete ---")