# Dino Fejzulovic — portfolio

A minimalist resume website with a black-and-white stadium illustration and horizontally scrolling resume chapters. Built with HTML, CSS, and JavaScript, with no dependencies or build step. Hosted at https://dinof15.github.io/.

## Preview locally

Use Node.js 22 or newer:

```sh
npm run dev
```

On Windows PowerShell, use `npm.cmd run dev` if the execution policy blocks `npm.ps1`. Open http://127.0.0.1:4173. Change the `PORT` environment variable if needed. The preview server binds only to your machine. Stop with Ctrl+C.

You can also open `index.html` directly. The copy-email button offers a manual fallback where clipboard access is unavailable.

## Edit the website

- `index.html`: resume chapters, contact details, metadata, and navigation.
- `css/portfolio.css`: typography, horizontal chapter layout, responsive styles, and print styles.
- `js/portfolio.js`: chapter navigation, history, mobile menu, and email copy.
- `js/stadium.js`: stadium ball animation and goal announcement.
- `img/stadium-sketch.svg`: original stadium illustration inspired by San Siro.
- `assets/Dino-Fejzulovic-Resume.pdf`: clean, current resume generated from the print stylesheet.
- `img/social-preview.png`: generated social sharing preview.
- `img/favicon.svg`: site icon.

Move between Home, About, Experience, Projects, Skills, Education, and Contact using the section links, chapter dots, or previous/next buttons. Left and right arrow keys navigate when the chapter viewer or a chapter heading has focus. Scroll down to read longer chapters; continuing at the bottom moves to the next chapter. Touch screens support native horizontal swiping. Section links update the URL so chapters can be bookmarked, and browser back/forward navigation works.

The stadium's hotspots are ordinary links to resume chapters. The kick button animates a football and announces a goal. Reduced-motion preferences skip the animation and smooth scrolling. Navigation moves keyboard focus to the destination heading. Without JavaScript, chapters form a conventional vertical page. The print layout includes the introduction, experience, projects, skills, and education in a clean resume. The old profile photo is not used.

The content comes from the supplied resume and the existing site, with Collins Aerospace updated from the owner's latest information. Its start date and technology stack are intentionally unspecified because they were not supplied. The original attachment includes a cover letter and student records and is not published.

## Verify and regenerate assets

```sh
npm run check
npm run test:browser
```

The source check validates JavaScript syntax, HTML IDs, and local asset references. The browser check uses an installed Chrome or Chromium browser and Node's native DevTools connection. Set `CHROME_PATH` to the executable if it is not detected. It starts the local preview server if needed; set `PREVIEW_URL` to check an already running server at another address.

Browser checks cover horizontal navigation, chapter focus and counters, deep links and history, keyboard and wheel navigation, native mobile swiping, responsive content access, stadium controls, clipboard copying, the mobile menu, reduced motion, and the stacked no-JavaScript fallback. The command also regenerates the resume PDF and 1200 by 630 social preview. Run it after changing content, and review those generated files before publishing. Screenshots and the browser profile are stored in ignored `.preview/`.

Check the site manually with a keyboard and on your own mobile device too. Automated browser checks are not a complete accessibility audit.

## Publish on GitHub Pages

Review locally, then commit and push the changes. Keep GitHub Pages configured to deploy the repository's root on your publishing branch. No build service or secrets are needed. `.nojekyll` enables direct static serving.

The old `vendor/`, `scss/`, `gulp.js`, `gulpfile.js`, `css/resume*`, and `js/resume*` files are retained as historical template assets and are not used by the new website. Do not run the old Gulp pipeline; edit the portfolio files above.
