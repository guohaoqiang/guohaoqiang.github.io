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
  <link rel="stylesheet" href="/style.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/default.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>body{{font-family:Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;margin:24px;max-width:900px}}</style>
</head>
<body>
  <article>
    <h1>{title}</h1>
    <div class="meta">{date}</div>
    <div class="content">{content}</div>
  </article>
  <script>document.querySelectorAll('pre code').forEach((b)=>{{try{{hljs.highlightElement(b)}}catch(e){{}}}})</script>
</body>
</html>'''


def slugify(name):
    name = name.lower()
    name = re.sub(r'[^a-z0-9\-]+', '-', name)
    name = re.sub(r'-+', '-', name)
    return name.strip('-')


def parse_md_metadata(text, filename):
    # Title: first H1
    lines = text.splitlines()
    title = None
    for ln in lines:
        if ln.strip().startswith('# '):
            title = ln.strip()[2:]
            break
    if not title:
        title = os.path.splitext(os.path.basename(filename))[0]
    # date: try to parse YYYY-MM-DD prefix
    base = os.path.basename(filename)
    m = re.match(r'(\d{4}-\d{2}-\d{2})-(.+)\.md', base)
    if m:
        date = m.group(1)
    else:
        date = datetime.now().strftime('%Y-%m-%d')
    # excerpt: first paragraph after title
    excerpt = ''
    found_title = False
    for ln in lines:
        if found_title:
            if ln.strip():
                excerpt = ln.strip()
                break
        if ln.strip().startswith('# '):
            found_title = True
    return title, date, excerpt


def build():
    posts = []
    md = markdown.Markdown(extensions=['fenced_code','tables'])
    for fname in sorted(os.listdir(POSTS_DIR), reverse=True):
        if not fname.endswith('.md'):
            continue
        path = os.path.join(POSTS_DIR, fname)
        with open(path, 'r', encoding='utf-8') as f:
            text = f.read()
        title, date, excerpt = parse_md_metadata(text, fname)
        slug = os.path.splitext(fname)[0]
        html = md.convert(text)
        out_html = TEMPLATE.format(title=title, date=date, content=html)
        out_path = os.path.join(OUT_DIR, slug + '.html')
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(out_html)
        posts.append({'title':title,'date':date,'slug':slug,'excerpt':excerpt})
        md.reset()
        print('Wrote', out_path)

    # write posts.json
    with open(os.path.join(OUT_DIR,'posts.json'),'w',encoding='utf-8') as f:
        json.dump(posts, f, indent=2)
    print('Wrote', os.path.join(OUT_DIR,'posts.json'))

if __name__=='__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    build()
