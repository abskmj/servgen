const fs = require('fs');
const path = require('path');

const debug = require('debug')('abskmj:servgen');

module.exports.init = async(app, options = {}) => {

    const defaultOptions = {
        services: [],
        local: null,
        order: [],
    }

    // merge options with defaults
    options = Object.assign(defaultOptions, options);

    // validate parameters

    // passed app instance should be an object
    if (!(app instanceof Object)) {
        throw new Error(`app instance passed is not an object`);
    }

    // passed local path should exists
    if (options.local && !fs.existsSync(options.local)) {
        throw new Error(`options.local passed does not exist`);
    }

    // passed order should be an array 
    if (!(options.order instanceof Array)) {
        throw new Error(`options.order passed is not an array`);
    }

    let services = {};

    // walk the services option

    for (let servDef of options.services) {
        if (servDef.module) {

            let defaultServDef = {
                parameters: []
            }

            servDef = Object.assign(defaultServDef, servDef);

            debug('processing a server definition:', JSON.stringify(servDef))

            let service = require(servDef.module);

            let name = servDef.as || servDef.module.split('servgen-').splice(-1);

            debug('with name:', name);

            services[name] = {
                service,
                parameters: servDef.parameters
            }

        }
        else {
            throw new Error(`service definition does not have a module name`);
        }
    }

    // walk the local path and get all available services
    if (options.local) walkDirectory(services, options.local);

    // attach services according to the order
    for (let serviceName of options.order) {
        await attachService(app, services, serviceName);
    }

    // attach remaining services
    for (let serviceName in services) {
        await attachService(app, services, serviceName);
    }
}

let attachService = async(app, services, serviceName) => {
    // check if app already has a service with same name
    if (app[serviceName]) {
        debug('app already has a service with name:', serviceName);
    }
    else {
        let service = services[serviceName].service;
        
        let parameters = services[serviceName].parameters || [];
        // add app as first parameter
        parameters.unshift(app);
        
        if (service && service instanceof Function) {
            app[serviceName] = await service.apply(null, parameters);
            debug('attached a new service with name:', serviceName);

            // remove service from list
            delete services[serviceName];
        }
        else {
            throw new Error(`service did not return a function. Path: ${services[serviceName]}`);
        }
    }
}

let walkDirectory = (services, directoryPath) => {
    const serviceExtension = '.js';

    let files = fs.readdirSync(directoryPath);

    files.forEach(file => {
        let filepath = path.join(directoryPath, file);
        debug('current file:', filepath);

        if (fs.statSync(filepath).isDirectory()) {
            debug('is a directory');

            let indexFile = path.join(filepath, 'index.js');

            if (fs.existsSync(indexFile)) {
                services[file] = { service: require(indexFile) };
            }
            else {
                console.error('abskmj/servgen', 'index.js not found inside the service directory');
                console.error('Directory:', filepath);
            }

        }
        else {
            if (file.startsWith(".")) return;
            
            if (file.endsWith(serviceExtension)) {
                debug('is a service file');

                let name = file.split(serviceExtension)[0];

                debug('service name:', name);

                services[name] = { service: require(filepath) };
            }
            else {
                console.log('file with unknown purpose', filepath);
            }
        }
    });
}
