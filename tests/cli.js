(function() {
  'use strict';

  var path = require('path');
  var spawn = require('child_process').spawn;
  var expect = require('expect.js');

  var rootDir = path.resolve(path.join(__dirname, '..'));
  var precompileBin = path.join(rootDir, 'bin', 'precompile');

  if (process.platform === 'win32') {
    precompileBin += '.cmd';
  }

  function execPrecompile(args, cb) {
    var child = spawn(precompileBin, args, {cwd: rootDir, shell: true});
    var stdout = '';
    var stderr = '';
    child.stdout.on('data', function(data) { stdout += data; });
    child.stderr.on('data', function(data) { stderr += data; });
    child.on('close', function(code) {
      if (code !== 0) {
        cb(new Error('exit code ' + code), stdout, stderr);
      } else {
        cb(null, stdout, stderr);
      }
    });
    child.on('error', cb);
  }

  describe('precompile cli', function() {
    it('should echo a compiled template to stdout', function(done) {
      execPrecompile(['tests/templates/item.njk'], function(err, stdout, stderr) {
        if (err) {
          done(err);
          return;
        }
        expect(stdout).to.contain('window.nunjucksPrecompiled');
        expect(stderr).to.equal('');
        done();
      });
    });

    it('should support --name', function(done) {
      var args = [
        '--name', 'item.njk',
        'tests/templates/item.njk',
      ];
      execPrecompile(args, function(err, stdout, stderr) {
        if (err) {
          done(err);
          return;
        }
        expect(stdout).to.contain('"item.njk"');
        expect(stderr).to.equal('');
        done();
      });
    });
  });
}());
