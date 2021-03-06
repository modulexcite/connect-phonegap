/*!
 * Module dependencies.
 */

var events = require('events'),
    fs = require('fs'),
    path = require('path'),
    phonegap = require('../lib'),
    request = require('request'),
    shell = require('shelljs'),
    callSuccess,
    callError,
    options;

/*!
 * Specification: phonegap.create(options)
 */

describe('phonegap.create(options)', function() {
    beforeEach(function() {
        options = {
            path: 'path/to/app',
            version: '3.3.0'
        };
        spyOn(phonegap.create, 'validateProjectPath');
        spyOn(phonegap.create, 'templateExists');
        spyOn(phonegap.create, 'downloadTemplate');
        spyOn(phonegap.create, 'createProject');
        callSuccess = function(options, callback) { callback(); };
        callError = function(options, callback) { callback(new Error('error')); };
    });

    it('should require options', function() {
        expect(function() {
            options = undefined;
            phonegap.create(options);
        }).toThrow();
    });

    it('should require options.path', function() {
        expect(function() {
            options.path = undefined;
            phonegap.create(options);
        }).toThrow();
    });

    it('should require options.version', function() {
        expect(function() {
            options.version = undefined;
            phonegap.create(options);
        }).toThrow();
    });

    it('should return an event emitter', function() {
        expect(phonegap.create(options)).toEqual(jasmine.any(events.EventEmitter));
    });

    describe('valid project path', function() {
        beforeEach(function() {
            phonegap.create.validateProjectPath.andCallFake(callSuccess);
        });

        describe('project template exists', function() {
            beforeEach(function() {
                phonegap.create.templateExists.andReturn(true);
            });

            it('should create the project', function(done) {
                phonegap.create(options);
                process.nextTick(function() {
                    expect(phonegap.create.createProject).toHaveBeenCalled();
                    done();
                });
            });

            describe('successfully create project', function() {
                beforeEach(function() {
                    phonegap.create.createProject.andCallFake(callSuccess);
                });

                it('should emit a complete event', function(done) {
                    phonegap.create(options).on('complete', function() {
                        done();
                    });
                });
            });

            describe('failed to create project', function() {
                beforeEach(function() {
                    phonegap.create.createProject.andCallFake(callError);
                });

                it('should emit an error event', function(done) {
                    phonegap.create(options).on('error', function(e) {
                        expect(e).toEqual(jasmine.any(Error));
                        done();
                    });
                });
            });
        });

        describe('project template missing', function() {
            beforeEach(function() {
                phonegap.create.templateExists.andReturn(false);
            });

            it('should download the template', function(done) {
                phonegap.create(options);
                process.nextTick(function() {
                    expect(phonegap.create.downloadTemplate).toHaveBeenCalled();
                    done();
                });
            });

            describe('successful download', function() {
                beforeEach(function() {
                    phonegap.create.downloadTemplate.andCallFake(callSuccess);
                });

                it('should create the project from the template', function(done) {
                    phonegap.create(options);
                    process.nextTick(function() {
                        expect(phonegap.create.createProject).toHaveBeenCalled();
                        done();
                    });
                });
            });

            describe('failed download', function() {
                beforeEach(function() {
                    phonegap.create.downloadTemplate.andCallFake(callError);
                });

                it('should emit an error event', function(done) {
                    phonegap.create(options).on('error', function(e) {
                        expect(e).toEqual(jasmine.any(Error));
                        done();
                    });
                });
            });
        });
    });

    describe('invalid project path', function() {
        beforeEach(function() {
            phonegap.create.validateProjectPath.andCallFake(callError);
        });

        it('should emit an error event', function(done) {
            phonegap.create(options).on('error', function(e) {
                expect(e).toEqual(jasmine.any(Error));
                done();
            });
        });
    });
});

describe('phonegap.create.validateProjectPath(options, callback)', function() {
    beforeEach(function() {
        options = {
            path: 'path/to/app'
        };
        spyOn(fs, 'existsSync');
        spyOn(fs, 'readdirSync');
    });

    describe('path does not exist', function() {
        it('should be valid', function(done) {
            fs.existsSync.andReturn(false);
            phonegap.create.validateProjectPath(options, function(e) {
                expect(e).toBeNull();
                done();
            });
        });
    });

    describe('path is empty directory', function() {
        it('should be valid', function(done) {
            fs.existsSync.andReturn(true);
            fs.readdirSync.andReturn(['.', '..']);
            phonegap.create.validateProjectPath(options, function(e) {
                expect(e).toBeNull();
                done();
            });
        });
    });

    describe('path contains files', function() {
        it('should be invalid', function(done) {
            fs.existsSync.andReturn(true);
            fs.readdirSync.andReturn(['.', '..', 'file.js']);
            phonegap.create.validateProjectPath(options, function(e) {
                expect(e).toEqual(jasmine.any(Error));
                done();
            });
        });
    });
});

describe('phonegap.create.templateExists(options)', function() {
    beforeEach(function() {
        options = {
            path: 'path/to/app',
            version: '3.3.0'
        };
        spyOn(fs, 'existsSync');
    });

    it('should test the global .cordova path', function() {
        phonegap.create.templateExists(options);
        // not the project-level .cordova/
        expect(fs.existsSync.calls[0].args[0]).not.toMatch(
            options.path
        );
        // has the full path
        expect(fs.existsSync.calls[0].args[0]).toEqual(
            phonegap.create.templatePath(options)
        );
    });

    it('should return true when directory exists', function() {
        fs.existsSync.andReturn(true);
        expect(phonegap.create.templateExists(options)).toEqual(true);
    });

    it('should return false when directory is missing', function() {
        fs.existsSync.andReturn(false);
        expect(phonegap.create.templateExists(options)).toEqual(false);
    });
});

describe('phonegap.create.fetchTemplate(options, callback)', function() {
    beforeEach(function() {
        options = {
            path: 'path/to/app',
            version: '3.3.0'
        };
    });

    describe('template exists', function() {
        beforeEach(function() {
            spyOn(phonegap.create, 'templateExists').andReturn(true);
            spyOn(phonegap.create, 'downloadTemplate');
        });

        it('should trigger the callback without an error', function(done) {
            phonegap.create.fetchTemplate(options, function(e) {
                expect(e).toEqual(null);
                done();
            });
        });

        it('should not download the template', function(done) {
            phonegap.create.fetchTemplate(options, function(e) {
                expect(phonegap.create.downloadTemplate).not.toHaveBeenCalled();
                done();
            });
        });
    });

    describe('template is missing', function() {
        beforeEach(function() {
            spyOn(phonegap.create, 'templateExists').andReturn(false);
            spyOn(phonegap.create, 'deleteInvalidTemplate');
            spyOn(phonegap.create, 'downloadTemplate').andCallFake(function(opts, cb) {
                cb();
            });
        });

        it('should trigger the callback without an error', function(done) {
            phonegap.create.fetchTemplate(options, function(e) {
                expect(e).toEqual(null);
                done();
            });
        });

        it('should delete corrupt templates and download new template', function(done) {
            phonegap.create.fetchTemplate(options, function(e) {
                expect(phonegap.create.deleteInvalidTemplate).toHaveBeenCalled();
                expect(phonegap.create.downloadTemplate).toHaveBeenCalledWith(
                    options,
                    jasmine.any(Function)
                );
                done();
            });
        });
    });
});

describe('phonegap.create.deleteInvalidTemplate(options)', function() {
    beforeEach(function() {
        options = {
            path: 'path/to/app',
            version: '3.3.0'
        };
        spyOn(shell, 'rm');
        spyOn(fs, 'existsSync');
        spyOn(phonegap.create, 'templatePath').andReturn('path/to/template');
        spyOn(phonegap.create, 'configXMLExists');
    });
    
    describe('when template does not exist', function() {
        it('should do nothing', function() {
            fs.existsSync.andReturn(false);
            phonegap.create.configXMLExists.andReturn(false);
            phonegap.create.deleteInvalidTemplate(options);
            expect(shell.rm).not.toHaveBeenCalled();
        });
    });
    
    describe('when valid template exists', function() {
        it('should do nothing', function() {
            fs.existsSync.andReturn(true);
            phonegap.create.configXMLExists.andReturn(true);
            phonegap.create.deleteInvalidTemplate(options);
            expect(shell.rm).not.toHaveBeenCalled();
        });        
    });
    
    describe('when invalid template exists', function() {
        it('should delete invalid template', function() {
            fs.existsSync.andReturn(true);
            phonegap.create.configXMLExists.andReturn(false);
            phonegap.create.deleteInvalidTemplate(options);
            expect(shell.rm).toHaveBeenCalledWith('-r', 'path/to/template');
        });          
    });
});

describe('phonegap.create.downloadTemplate(options, callback)', function() {
    // find a nice way to test request
});

describe('phonegap.create.createProject(options, callback)', function() {
    beforeEach(function() {
        options = {
            path: 'path/to/app',
            version: '3.3.0'
        };
        spyOn(shell, 'mkdir');
        spyOn(shell, 'cp');
        spyOn(fs, 'existsSync').andReturn(false); // do not move config.xml
        spyOn(fs, 'renameSync'); // disable moving config.xml
    });

    it('should create path containing the project', function() {
        phonegap.create.createProject(options);
        expect(shell.mkdir).toHaveBeenCalledWith('-p', path.resolve(options.path));
    });

    it('should create the project', function() {
        phonegap.create.createProject(options);
        // copy the template project
        expect(shell.cp.calls[0].args[0]).toEqual('-R');
        expect(shell.cp.calls[0].args[1]).toEqual(
            // tested on OS X and Windows
            path.join(phonegap.create.templatePath(options), 'www')
        );
        expect(shell.cp.calls[0].args[2]).toEqual(path.resolve(options.path));
        // create additional directories
        expect(shell.mkdir.calls[1].args[1]).toEqual([
            path.join(options.path, '.cordova'),
            path.join(options.path, 'hooks'),
            path.join(options.path, 'platforms'),
            path.join(options.path, 'plugins')
        ]);
    });

    describe('when my-app/www/config.xml exists', function() {
        beforeEach(function() {
            fs.existsSync.andReturn(true);
        });

        it('should move the file to my-app/config.xml', function() {
            phonegap.create.createProject(options);
            expect(fs.existsSync).toHaveBeenCalled();
            expect(fs.renameSync).toHaveBeenCalled();
        });
    });

    describe('when my-app/www/config.xml is missing', function() {
        beforeEach(function() {
            fs.existsSync.andReturn(false);
        });

        it('should not move the file to my-app/config.xml', function() {
            phonegap.create.createProject(options);
            expect(fs.existsSync).toHaveBeenCalled();
            expect(fs.renameSync).not.toHaveBeenCalled();
        });
    });

    describe('successfully create project', function() {
        it('should trigger callback without error', function(done) {
            phonegap.create.createProject(options, function(e) {
                expect(e).toBeNull();
                done();
            });
        });
    });

    describe('failed to create project', function() {
        beforeEach(function() {
            spyOn(shell, 'error').andReturn(new Error('an error'));
        });

        it('should trigger callback with error', function(done) {
            phonegap.create.createProject(options, function(e) {
                expect(e).toEqual(jasmine.any(Error));
                done();
            });
        });
    });
});
