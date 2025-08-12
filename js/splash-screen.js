import { viewer } from "./viewer.js";


export function initializeSplashScreen() {
    //INFOBOXES
    if (viewer.infoBox?.frame) {
        viewer.infoBox.frame.removeAttribute("sandbox");
        viewer.infoBox.frame.setAttribute("sandbox", "allow-same-origin allow-popups allow-forms allow-scripts");
        viewer.infoBox.frame.src = "about:blank";
        //INFOBOXSLUTES
        
        // Functions to show/hide info boxes
        function startInfoBoxes() {
            showInfoBox('infoBox1');
        }
        // Additional functions for the new info boxes
        function showInfoBox(boxId) {
            var infoBox = document.getElementById(boxId);
            if (!infoBox) return
            infoBox.style.display = 'block';
        }
        startInfoBoxes();
    
        let closeSplash = document.getElementById('Splash');
        closeSplash?.addEventListener('click', function() {
            closeInfoBox('infoBox1');
        });
    
        function closeInfoBox(boxId) {
            var infoBox = document.getElementById(boxId);
            infoBox.style.display = 'none';
        }
    }
    
}

