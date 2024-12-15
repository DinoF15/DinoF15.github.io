const gulp = require('gulp');
const browserSync = require('browser-sync').create();
const sass = require('gulp-sass')(require('sass'));

// Compile Sass
function compileSass() {
  return gulp
    .src('src/scss/**/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('dist/css'))
    .pipe(browserSync.stream());
}

// Serve and Watch
function serve() {
  browserSync.init({ server: './dist' });
  gulp.watch('src/scss/**/*.scss', compileSass);
  gulp.watch('src/*.html').on('change', browserSync.reload);
}

// Default Task
exports.default = gulp.series(compileSass, serve);
exports.build = gulp.series(compileSass);