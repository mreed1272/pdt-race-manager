
function updateLaneDisplay(ulID) {
    for (var i = 0; i < laneMask.length; i++) {
        var tempLaneId = `${ulID}-lane${i + 1}-Li`;
        //console.log(`temp lane Id: ${tempLaneId}`);
        switch (laneMask[i]) {
            case 1:
                document.getElementById(tempLaneId).style = "visibility: hidden;";
                //console.log(`Hiding lane ${i + 1}.`);
                break;
            case 0:
                document.getElementById(tempLaneId).style = "visibility: visible;";
                //console.log(`Showing lane ${i + 1}`);
                break;
        };
    }
}

function clearDisplay() {
    var tempDisplay = document.getElementsByClassName("LEDdisplay");
    //var tempWinner1 = Array.prototype.slice.call(document.getElementsByClassName("winner1"));
    for (var i = 0; i < tempDisplay.length; i++) {
        tempDisplay[i].innerHTML = "0.0000";
    }
    clearClass("winner1");
    clearClass("winner2");
    clearClass("winner3");

    laneTimes.length = 0;
}

function clearHistory() {
    var outStr = "<tr><th>Run #</th><th>Time (s)</th><th>Delta (s)</th></tr>";
    clearText("lane-history-table", outStr);
    document.getElementById("test-notes").value = "";
    runNum = 1;
}

function saveHistory() {
    var currentWindowObj = remote.getCurrentWindow();

    dialog.showSaveDialog(currentWindowObj, {
        title: 'Save History file. . .',
        filters: [
            {
                name: "PDT history files",
                extensions: ['pdth', 'pdt_history']
            }
        ]
    }, (filenames) => {
        //console.log(`Filenames from save dialog: ${filenames}`);
        if (!filenames) return;
        if (filenames.length > 0) {
            //generate txt
            var contents = {};
            contents["lane"] = document.getElementById("test-lane-watch").value;
            contents["notes"] = document.getElementById("test-notes").value;
            contents["session_date"] = document.getElementById("test-date").innerHTML;
            contents["session_table"] = document.getElementById("lane-history-table").innerHTML;
            var contentJSON = JSON.stringify(contents);
            //save txt
            fs.writeFileSync(filenames, contentJSON);
        }
    })
}

function loadHistory() {
    var currentWindowObj = remote.getCurrentWindow();

    dialog.showOpenDialog(currentWindowObj, {
        title: 'Select history file to open:',
        filters: [
            {
                name: 'PDT history files',
                extensions: ['pdth', 'pdt_history']
            }
        ]
    }, (filenames) => {
        if (!filenames) return;
        if (filenames.length > 0) {
            var tmpData = fs.readFileSync(filenames[0]);
            // parse, format input txt and put into page
            var dataObj = JSON.parse(tmpData);
            document.getElementById("test-lane-watch").value = dataObj["lane"];
            //console.log(dataObj["lane"]);
            setLane(dataObj["lane"]);
            document.getElementById("test-notes").value = dataObj["notes"];
            document.getElementById("test-date").innerHTML = dataObj["session_date"];
            document.getElementById("lane-history-table").innerHTML = dataObj["session_table"];

            remote.app.addRecentDocument(filenames[0]);
        }
    })
}

function setLane(laneNum) {
    //console.log(`setLane argument: ${laneNum}`);
    if (laneNum == 0) {
        // uncheck all the checkboxes
        for (var i = 0; i < numLanes; i++) {
            document.getElementById(`tlane-mask${i + 1}`).checked = false;
        }
    } else if (laneNum > 0) {
        //first let's check all lane mask checkboxes
        for (var i = 0; i < numLanes; i++) {
            document.getElementById(`tlane-mask${i + 1}`).checked = true;
            //laneMask[i] = 1;
        }
        //now uncheck the one that we need to watch
        document.getElementById(`tlane-mask${laneNum}`).checked = false;
    }
    setMask("tlane");
}

function setMask(ulID) {
    //check to see if a lane is checked and then mask it
    for (var i = 0; i < numLanes; i++) {
        if (document.getElementById(`${ulID}-mask${i + 1}`).checked) {
            laneMask[i] = 1;

        } else {
            laneMask[i] = 0;
        };
    };
    console.log(`LaneMask - ${laneMask}`);
    updateLaneDisplay(ulID);
    writeToArduino("U");
    for (var i = 0; i < laneMask.length; i++) {
        if (laneMask[i] === 1) {
            writeToArduino(`M${i + 1}`);
        };
    };
}

function updateHistoryTable(runObj) {
    var outStr = "";
    var hTable = document.getElementById("lane-history-table");

    runObj.sort(function (a, b) {
        return a.lane - b.lane;
    });

    for (var i = 0; i < runObj.length; i++) {
        if (runObj[i].time != 99) {
            outStr += "<tr>";
            outStr += `<td>${runNum} (${runObj[i].lane})</td>`;
            outStr += `<td>${runObj[i].time}</td>`;
            if (runNum == 1) {
                outStr += "<td>-</td>"
            } else {
                var tempTime2 = lastRunTimes[i].time;
                var tempTime1 = runObj[i].time;
                var deltaTime = (tempTime1 - tempTime2).toPrecision(4);
                outStr += `<td>${deltaTime}</td>`;
            }
            outStr += "</tr>"
        };
    }
    hTable.innerHTML += outStr;

    lastRunTimes = JSON.parse(JSON.stringify(runObj));
    //console.log(lastRunTimes);
    //console.log(runObj);
    runNum++;
}
