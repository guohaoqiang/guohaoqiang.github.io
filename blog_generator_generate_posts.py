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

POSTS_DIR = 'posts'
OUT_DIR = 'posts'

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
    }}
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
  </style>
</head>
<body>
  <article>
    <h1>{title}</h1>
    <div class="meta">Published on {date}</div>
    
    <div class="excerpt">{excerpt}</div>

    <div class="content">
      {content}
    </div>
  </article>
  
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
  <script>hljs.highlightAll();</script>
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
        
        # Automatically inject [TOC] marker if not present to force ToC generation
        if '[TOC]' not in text:
            text = "[TOC]\n\n" + text
            
        html = md.convert(text)
        
        # Create directory for Pretty URL
        post_dir = os.path.join(OUT_DIR, slug)
        os.makedirs(post_dir, exist_ok=True)
        
        out_html = TEMPLATE.format(title=title, date=date, excerpt=excerpt, content=html, slug=slug)
        
        with open(os.path.join(post_dir, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(out_html)
            
        posts.append({'title':title, 'date':date, 'slug':slug, 'excerpt':excerpt})
        md.reset()
        print(f'Done: {slug}/index.html')

    with open(os.path.join(OUT_DIR, 'posts.json'), 'w', encoding='utf-8') as f:
        json.dump(posts, f, indent=2)

if __name__=='__main__':
    build()