import * as nodered from "node-red" ;

import semaphore from 'semaphore' ;

interface semaphoreNodenterface extends nodered.Node {
    capacity : number ;
    timeout : number ;
    semaphore : any ;
    observers : any[ any ] ;
    subscribe : ( fn : any ) => void ;
    unsubscribe : ( fn : any ) => void ;
    broadcast : () => void ;
}

module.exports = function (RED: nodered.NodeAPI) {

    /**
     * 
     */
    RED.nodes.registerType( "semaphore-config",
        function (this: nodered.Node, config: any): void {
            RED.nodes.createNode(this, config);
            var node: semaphoreNodenterface = <semaphoreNodenterface> this;

            node.name = config.name;
            node.capacity = config.capacity || 1;
            node.timeout = (config.timeout || 0) * 1000 ;
            node.semaphore = semaphore(node.capacity);
            node.observers = [];
    
            node.subscribe = function (fn : any ) {
                node.observers.push(fn);
            };
    
            node.unsubscribe = function (fn : any) {
                node.observers = node.observers.filter((observer : any ) => observer !== fn);
            };
    
            node.broadcast = function () {
                node.observers.forEach((observer : any ) => observer(node));
            };

            node.log( "semaphore-config: done.")
        });

        /**
         * 
         */
        RED.nodes.registerType( "semaphore-take",
        function (this: nodered.Node, config: any): void {
            RED.nodes.createNode(this, config);
            var node: nodered.Node = this;

            var semaphoreConfig = <semaphoreNodenterface> RED.nodes.getNode( config.config ) ;
            const sem = semaphoreConfig.semaphore;

            node.status({ fill: "green", shape: "dot", text: semaphoreConfig.name + " ready" });

            const updateStatus = function (config : any ) {
                const capacity = config.semaphore.capacity;
                const size = config.semaphore.current + config.semaphore.queue.length;
                const fill = (size > capacity) ? "yellow" : "grey";

                node.status({ fill: fill, shape: "dot", text: config.name + ": " + size + " / " + capacity});
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
    
            node.on('close', ()=> {
                semaphoreConfig.unsubscribe(updateStatus);
                node.status({});
            });

        });

        /**
         * 
         */
        RED.nodes.registerType( "semaphore-leave",
        function (this: nodered.Node, config: any): void {
            RED.nodes.createNode(this, config);
            var node: semaphoreNodenterface = <semaphoreNodenterface> this;
            var timerId : any ;
            
            var semaphoreConfig = <semaphoreNodenterface> RED.nodes.getNode( config.config ) ;
            const sem = semaphoreConfig.semaphore;

            node.status({ fill: "green", shape: "dot", text: semaphoreConfig.name + " / None" });
            node.log( semaphoreConfig.name + " timeout: " + semaphoreConfig.timeout ) ;
            
            const leave = function( f ?: boolean ) : void {
                var size : number = semaphoreConfig.semaphore.current + semaphoreConfig.semaphore.queue.length ;
                
                node.status({
                    fill: f || size == 0 ? "green" : "yellow",
                    shape: "dot",
                    text: semaphoreConfig.name 
                        + " / " 
                        + (size == 0 ? "None" : f ? "Leave" : "Timeout") }) ;
                
                if( size > 0 ) {
                    sem.leave();
                    semaphoreConfig.broadcast();
                }

                if( semaphoreConfig.timeout > 0 ) {
                    clearTimeout( timerId ) ;
                    timerId = setTimeout( leave, semaphoreConfig.timeout) ;
                }
            }
            
            if( semaphoreConfig.timeout > 0 )
                timerId = setTimeout( leave, semaphoreConfig.timeout) ;

            node.on('input', (msg) => {
                leave( true ) ;
                node.send(msg);
            });
        });
};