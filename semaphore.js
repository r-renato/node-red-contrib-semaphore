"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const semaphore_1 = __importDefault(require("semaphore"));
module.exports = function (RED) {
    /**
     *
     */
    RED.nodes.registerType("semaphore-config", function (config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.name = config.name;
        node.capacity = config.capacity || 1;
        node.timeout = (config.timeout || 0) * 1000;
        node.semaphore = (0, semaphore_1.default)(node.capacity);
        node.observers = [];
        node.subscribe = function (fn) {
            node.observers.push(fn);
        };
        node.unsubscribe = function (fn) {
            node.observers = node.observers.filter((observer) => observer !== fn);
        };
        node.broadcast = function () {
            node.observers.forEach((observer) => observer(node));
        };
        node.log("semaphore-config: done.");
    });
    /**
     *
     */
    RED.nodes.registerType("semaphore-take", function (config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var semaphoreConfig = RED.nodes.getNode(config.config);
        const sem = semaphoreConfig.semaphore;
        node.status({ fill: "green", shape: "dot", text: semaphoreConfig.name + " ready" });
        const updateStatus = function (config) {
            const capacity = config.semaphore.capacity;
            const size = config.semaphore.current + config.semaphore.queue.length;
            const fill = (size > capacity) ? "yellow" : "grey";
            node.status({ fill: fill, shape: "dot", text: config.name + ": " + size + " / " + capacity });
            if (size === 0)
                node.status({ fill: "green", shape: "dot", text: config.name + " ready" });
        };
        semaphoreConfig.subscribe(updateStatus);
        node.on('input', (msg) => {
            sem.take(() => {
                node.send(msg);
            });
            semaphoreConfig.broadcast();
        });
        node.on('close', () => {
            semaphoreConfig.unsubscribe(updateStatus);
            node.status({});
        });
    });
    /**
     *
     */
    RED.nodes.registerType("semaphore-leave", function (config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var timerId;
        var semaphoreConfig = RED.nodes.getNode(config.config);
        const sem = semaphoreConfig.semaphore;
        node.status({ fill: "green", shape: "dot", text: semaphoreConfig.name + " / None" });
        node.log(semaphoreConfig.name + " timeout: " + semaphoreConfig.timeout);
        const leave = function (f) {
            var size = semaphoreConfig.semaphore.current + semaphoreConfig.semaphore.queue.length;
            node.status({
                fill: f || size == 0 ? "green" : "yellow",
                shape: "dot",
                text: semaphoreConfig.name
                    + " / "
                    + (size == 0 ? "None" : f ? "Leave" : "Timeout")
            });
            if (size > 0) {
                sem.leave();
                semaphoreConfig.broadcast();
            }
            if (semaphoreConfig.timeout > 0) {
                clearTimeout(timerId);
                timerId = setTimeout(leave, semaphoreConfig.timeout);
            }
        };
        if (semaphoreConfig.timeout > 0)
            timerId = setTimeout(leave, semaphoreConfig.timeout);
        node.on('input', (msg) => {
            leave(true);
            node.send(msg);
        });
    });
};
//# sourceMappingURL=semaphore.js.map