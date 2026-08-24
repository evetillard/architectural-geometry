---
title: Read Me
---

## Recommended page structure

Each surface page should contain, in this order:

- the page title, defined in the YAML frontmatter;

- one or more general illustrations;

- an identity card;

- one section for each significant property of the surface;

- within each property: geometric explanation and form generation, building implications, and built examples.

The bibliography is generated automatically at the bottom of any page that contains citations. Do not add a separate ## References heading.

## General rules for images

- Store page images in the local images/ folder.

- Use relative paths beginning with images/.

- Always include the file extension, for example .svg, .jpg, .png or .webp.

- Prefer lowercase filenames without spaces or accented characters.

- Add meaningful alternative text with the alt attribute.

- Add a caption and, when necessary, the image source or credit.

- Select the layout according to the number and intended size of the images.

## Figure layouts

### Three images : figure-1

Use this layout for a sequence, a three-part comparison or three complementary views.

::::{div}
:class: figure-1

:::{div}
:class: figure-1-row

<div class="figure-1-slot">
  <img src="images/first_image.svg" alt="Description of the first image">
</div>

<div class="figure-1-slot">
  <img src="images/second_image.svg" alt="Description of the second image">
</div>

<div class="figure-1-slot">
  <img src="images/third_image.svg" alt="Description of the third image">
</div>

:::

:::{div}
:class: figure-1-caption

Caption describing the three images.

:::

::::

### One large image : figure-2

Use this layout for a photograph, a general diagram or a large detailed illustration.

::::{div}
:class: figure-2

:::{div}
:class: figure-2-image

<img src="images/image_name.jpg" alt="Description of the image">

:::

:::{div}
:class: figure-2-caption

Caption describing the image.

:::

::::

### Two images : figure-3

Use this layout for a comparison or two complementary views.

::::{div}
:class: figure-3

:::{div}
:class: figure-3-row

<div class="figure-3-slot">
  <img src="images/first_image.svg" alt="Description of the first image">
</div>

<div class="figure-3-slot">
  <img src="images/second_image.svg" alt="Description of the second image">
</div>

:::

:::{div}
:class: figure-3-caption

Caption describing the two images.

:::

::::

### One small image : figure-4

Use this layout when the image should remain compact, for example for a simple diagram or a small geometric variation.

::::{div}

:::{div}
:class: figure-4-row

<div class="figure-4-slot">
  <img src="images/image_name.svg" alt="Description of the image">
</div>

:::

:::{div}
:class: figure-4-caption

Caption describing the image.

:::

::::

### Video or animation : video-figure

Store the video in the page's images/ folder and use:

:::{figure} ./images/animation_name.mp4
:class: video-figure

Caption describing the animation.

:::

## Identity card

The identity card provides a concise overview before the detailed sections.

:::{div}
:class: identity-card

**Name**: Full Surface Name — (Alternative name, abbreviation)

**Equation**:

$$
z = f(x,y)
$$

**Surface family**:

<a class="tag"
   href="../../portals/form/surface_families/FOLDER_NAME/home">
  Tag label
</a>

**Geometric properties**:

<a class="tag"
   href="../../portals/form/geometric_properties/FOLDER_NAME/home">
  Tag label
</a>

:::

Duplicate the complete <a class="tag">...</a> block when several tags are required.

Use the real folder name in each link. Repository paths are case-sensitive on the published website and must use forward slashes /. Do not replace underscores with hyphens unless the real folder name contains a hyphen.

If the surface has no single canonical equation, provide a relevant parametric representation or remove the Equation field.

## Bibliography and citations

## Citations and bibliography

Add BibTeX entries to the page's initially empty `references.bib` file. Copy and adapt one of the examples below. Do not prefix BibTeX examples with `%`: it is not a reliable comment character in `.bib` files and may cause parsing errors.

Each citation key must be unique across the entire website. A recommended format is : surnameYEARkeyword


Examples of citations in `home.md`:

This statement is supported by a reference [@surname2026keyword].

Surname explains this property in detail @surname2026keyword.

Several references may be cited together [@surname2026keyword; @other2024example].


### Book

```bibtex
@book{surname2026keyword,
  author = {Surname, Firstname},
  title = {Title of the Book},
  publisher = {Publisher Name},
  address = {City},
  year = {2026},
  isbn = {978-0-00-000000-0}
}
```

### Journal article

```bibtex
@article{surname2026keyword,
  author = {Surname, Firstname and Surname, Firstname},
  title = {Title of the Article},
  journal = {Name of the Journal},
  year = {2026},
  volume = {12},
  number = {3},
  pages = {101--120},
  doi = {10.0000/example-doi},
  url = {https://doi.org/10.0000/example-doi}
}
```

### Website or online resource

```bibtex
@misc{organisation2026keyword,
  author = {{Organisation Name}},
  title = {Title of the Web Page},
  year = {2026},
  url = {https://www.example.org/page},
  note = {Accessed 24 August 2026}
}
```

After adding or removing a `references.bib` file, synchronize the project bibliography from the repository root:

```powershell
npm run sync:bibliography
```


## Internal links

For a page generated under surfaces/SURFACE_NAME/home.md, links to portal pages usually begin with:

../../portals/

Example:

[revolution surface](../../portals/form/surface_families/revolution_surfaces/home.md)

Always verify the real directory name instead of guessing the URL.

## Editing this template

The template is intentionally expected to evolve with the editorial model of the website. When changing it:

- preserve the {{TITLE}} placeholder;

- keep template instructions in HTML comments when they should not appear on generated pages;

- test the generator with a temporary surface;

- verify that the temporary page builds successfully;

- confirm that an existing destination is never overwritten;

- remove the temporary surface after the test.