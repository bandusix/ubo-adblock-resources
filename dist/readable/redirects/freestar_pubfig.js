// ubo-resources: name=freestar_pubfig.js
// ubo-resources: kind=application/javascript

(( ) => {
    try {
        self.localStorage.removeItem('fs.cdi');
        self.localStorage.removeItem('fs.cfc');
    } catch {
    }
})();
