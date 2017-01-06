

module.exports = (grunt) => {

  const config = {
    js: {
      all: ['Gruntfile.js', 'src/**/*.js', '!**/node_modules/**/*']
    }
  };

  grunt.initConfig({

    pkg: grunt.file.readJSON('package.json'),

    eslint: {
      target: config.js.all
    }

  });

  grunt.loadNpmTasks('grunt-eslint');

  grunt.registerTask('standards', ['eslint']);
  grunt.registerTask('default', ['standards']);

};
