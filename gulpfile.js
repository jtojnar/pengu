var gulp = require('gulp');
var autoprefix = require('gulp-autoprefixer');
var csso = require('gulp-csso');

var config = {
	public: './client'
}

gulp.task('css', function() {
	return gulp.src('./assets/client.css')
		.pipe(csso())
		.pipe(autoprefix('last 2 versions'))
		.pipe(gulp.dest(config.public));
});

gulp.task('watch', function() {
	gulp.watch('./assets/*.css', ['css']);
});

gulp.task('default', gulp.parallel('css'));
