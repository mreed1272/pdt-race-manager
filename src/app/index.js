const electron = require('electron');
const remote = electron.remote;
const dialog = electron.remote.dialog;
const shell = electron.shell;
const fs = require('fs');
const ipcRenderer = electron.ipcRenderer;
const nativeImage = electron.nativeImage;

let PDTimage = `${__dirname}/images/PDT-main.png`;

var racerStats = [];
var racerStatsFile = "";
var raceInformation = {};
var raceInfoFile = "";

var optionsPDT = [];
var rankValuePDT = [];
var rankTextPDT = [];

var includedRacers = [];

var lastSerialCommand = "";
var lastSerialResponse = "";

var initArduino = false;
var initLane = false;

var currentTab = "mainT";
var currentSessionDate = new Date();

var runNum = 1;
var lastRunTimes = [];

var laneMask = [];
var laneTimes = [];
var numLanes = 2; //default to 2 lanes
var numRounds = 0;
var timerId = null;



function onBodyLoad() {
  //console.log("Starting main body load function");
  document.getElementById("RaceSideDialog").style.width = 0;
  document.getElementById("mainT").style.display = "block";
  document.getElementById("RacerInfo").style.display = "none";

  //console.log("Setting interval checker...");
  timerID = setInterval(() => {
    if(readyArduino !== null && initLane === true && readySerial === true){
      setTimeout(() => {ipcRenderer.send('done-loading');}, 3000);
      if (timerId != null) {
        clearInterval(timerID);
      }
    }
  }, 250);

  //console.log("calling loadOptions. . .")
  loadOptions();
  //console.log("calling initSerial. . .")
  initSerial();

  //console.log("end of onBodyLoad")
}

function openTabContent(evt, tabName) {
  var i, tabcontent, tablinks;
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  tablinks = document.getElementsByClassName("selected");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace("selected", "");
  }
  document.getElementById(tabName).style.display = "block";
  evt.currentTarget.className += "selected";
  currentTab = tabName;

  if (tabName == "testTrackT") {
    var tempSessionDate = currentSessionDate.toDateString();
    document.getElementById("test-date").innerHTML = tempSessionDate;
  }
}

function loadSelect(selectID, optValueArr, selectItem, optTextArr) {
  var selElem = document.getElementById(selectID);
  if (selElem.options.length > 0) {
    if (selectID !== "test-lane-watch") {
      removeSelectOptions(selElem);
    }
  };

  for (var i = 0; i < optValueArr.length; i++) {
    var option = document.createElement("option");
    if (optTextArr !== undefined) {
      option.text = optTextArr[i];
    } else {
      option.text = optValueArr[i];
    };
    option.value = optValueArr[i];
    selElem.add(option, i);
    if (optValueArr[i] == selectItem) {
      selElem.selectedIndex = i;
    }
  }
}

function initLanes(numLanes, ulId, showMask) {
  //console.log(`Starting initLanes(${numLanes},${ulId},${showMask})`);
  var selElem = document.getElementById(ulId);
  var liID = "";
  var liLane = null;
  var maskOut = "";

  for (var i = 1; i <= numLanes; i++) {
    liID = `${ulId}-lane${i}-Li`;
    var spanID = `${ulId}-lane${i}`;
    liLane = document.createElement("li");

    liLane.id = liID;
    /*if (!initArduino && i === 1) {
      liLane.className = "winner1";
    }*/
    liLane.innerHTML = `Lane ${i}: <span class="LEDdisplay" id="${spanID}">0.0000</span> s`;
    selElem.appendChild(liLane);
  }

  liID = `${ulId}-mask-Li`;
  liLane = document.createElement("li");
  liLane.id = liID;
  if (showMask) {
    liLane.className = "laneMask";
  } else {
    liLane.className = "hide laneMask";
  }
  maskOut = "Mask Lanes: <br/>";
  for (var i = 1; i <= numLanes; i++) {
    maskOut += ` Lane ${i} <input type="checkbox" id="${ulId}-mask${i}" value="${i}" onchange="setMask('${ulId}')"> `;
    if (numLanes > 4 && i > ((numLanes / 2) - 0.5) && i <= ((numLanes / 2) + 0.5)) {
      maskOut += "<br/>";
    }
  };
  liLane.innerHTML = maskOut;
  selElem.appendChild(liLane);


  if (laneMask.length == "0") {
    console.log("Initializing laneMask variable")
    for (var i = 0; i < numLanes; i++) {
      laneMask[i] = 0;
    }
  }
  //console.log(`Ending initLanes(${numLanes},${ulId},${showMask})`);
}

function clearClass(class_Name) {
  var tempArr = Array.prototype.slice.call(document.getElementsByClassName(class_Name));
  if (tempArr.length !== 0) {
    for (var i = 0; i < tempArr.length; i++) {
      var tempClass = tempArr[i].className
      tempArr[i].className = tempClass.replace(class_Name, "");
    }
  }
}

function clearText(elemID, newTxt) {
  var tempElem = document.getElementById(elemID);
  tempElem.innerHTML = newTxt;
}

function loadRace() {
  var raceInfoFileDiv = document.getElementById("RaceInfoFile");
  var currentWindowObj = remote.getCurrentWindow();

  dialog.showOpenDialog(currentWindowObj, {
    title: 'Select Race Information file to open:',
    filters: [
      {
        name: 'PDT race files',
        extensions: ['pdt_race']
      }
    ]
  }, (filenames) => {
    if (!filenames) return;
    if (filenames.length > 0) {
      var tmpData = fs.readFileSync(filenames[0]);

      //clear race information if something curently loaded
      if (!isObjEmpty(raceInformation)) {
        checkRaceDialog('cancel');
      }
      // parse, format input txt and put into page
      raceInformation = JSON.parse(tmpData);

      remote.app.addRecentDocument(filenames[0]);
      raceInfoFileDiv.innerHTML = filenames[0].split('\\').pop().split('/').pop();
      raceInfoFile = filenames[0];
      updateRaceInfo();
      //console.log("Sending communication to 'race-information' channel.");
      ipcRenderer.send('race-information', [raceInformation, numLanes]);
    }
  })
}

function saveRace() {
  if (isObjEmpty(raceInformation)) {
    return -1;
  };

  var raceInfoFileDiv = document.getElementById("RaceInfoFile");
  var currentWindowObj = remote.getCurrentWindow();

  dialog.showSaveDialog(currentWindowObj, {
    title: 'Save Race . . .',
    filters: [
      {
        name: "PDT race information files",
        extensions: ['pdt_race']
      }
    ]
  }, (filenames) => {
    if (!filenames) return;
    if (filenames.length > 0) {
      var contentJSON = JSON.stringify(raceInformation);

      //save txt
      fs.writeFileSync(filenames, contentJSON);

      raceInfoFileDiv.innerHTML = filenames.split('\\').pop().split('/').pop();
      raceInfoFile = filenames;
    }
  })
  /*document.activeElement.blur();*/
}

function checkRaceDialog(type) {
  if (isRacing) {
    return -1;
  }
  var editSideDialog = document.getElementById("RaceSideDialog");

  if (editSideDialog.style.width !== "0px") {
    editSideDialog.style.width = "0px";
    setTimeout(() => {
      editRaceDialog(type)
    }, 700);
  } else {
    editRaceDialog(type);
  }
}

function clickMenuTab(tabNum) {
  var tabMenu = document.getElementById("tabbedItems").getElementsByTagName("ul")[0].getElementsByTagName("li")

  tabMenu[tabNum].click();
}

function editRaceDialog(type) {
  if (isRacing) {
    return -1;
  }
  var editSideDialog = document.getElementById("RaceSideDialog");
  var headerDialog = editSideDialog.getElementsByTagName("h2")[0];
  var closeSpan = document.getElementsByClassName("close")[0];
  var dialogButton = document.getElementById("editRaceButton");

  var orgNameInput = document.getElementById("orgName");
  var orgTypeInput = document.getElementById("OrgTypeSelect");
  var rankCheckBox = document.getElementById("orgRankInclude").getElementsByTagName("input");
  var raceRoundsInput = document.getElementById("raceRounds");
  var raceScoreInput = document.getElementById("raceScoreMethod");
  var raceCoordInput = document.getElementById("raceCoord");
  var raceDateInput = document.getElementById("raceDate");
  var racerInputTD = document.getElementById("racerFileInput");

  var rankCheck = document.getElementById("orgRankInclude").getElementsByTagName("input");

  if (racerStatsFile === "" || racerStatsFile === undefined) {
    racerInputTD.innerHTML = `<button type="button" onclick='loadRacers()'>Select Racers File</button> <button type="button" onclick='clickMenuTab(2)'>Enter New Racers</button>`
  } else {
    racerInputTD.innerHTML = racerStatsFile.split('\\').pop().split('/').pop();
  }

  switch (type) {

    case "new":
      if (!isObjEmpty(raceInformation)) {
        var response = dialog.showMessageBox(remote.getCurrentWindow(), {
          title: "Discard Race?",
          type: "warning",
          buttons: ["Ok", "Cancel"],
          message: "Are you sure want to continue?  All existing race information will be reset."
        })
        //alert("Are you sure want to continue?  All existing race information will be reset.");
        if (response == 1) {
          return -1;
        }
        orgNameInput.value = "";
        orgTypeInput.value = "Cub Scout";
        loadRanks("Cub Scout");
        raceRoundsInput.value = "";
        raceScoreInput.value = "timed";
        raceCoordInput.value = "";
        raceDateInput.value = "";
        editSideDialog.style.width = "0";
        clearRacers();
        clearObject(raceInformation);
        updateRaceInfo();
        raceInfoFile = "";
        document.getElementById("RaceInfoFile").innerHTML = raceInfoFile.split('\\').pop().split('/').pop();
      }
      headerDialog.innerHTML = "New Race";
      dialogButton.innerHTML = "OK";
      break;

    case "edit":
      if (isObjEmpty(raceInformation)) {
        return -1;
      } else {
        headerDialog.innerHTML = "Edit Race";
        dialogButton.innerHTML = "Update";

        //load the information from the object into the form
        orgNameInput.value = raceInformation["OrgName"];
        orgTypeInput.value = raceInformation["OrgType"];
        raceRoundsInput.value = raceInformation["RaceRounds"];
        raceScoreInput.value = raceInformation["RaceScoring"];
        raceCoordInput.value = raceInformation["RaceCoordinator"];
        raceDateInput.value = raceInformation["RaceDate"];
        racerStatsFile = raceInformation["RacerStatsFile"];
        for (var i = 0; i < raceInformation.RacerRanks.length; i++) {
          document.getElementById(`rank-${raceInformation.RacerRanks[i]}`).checked = true;
        };

      }
      break;

    case "update":
      var tmpIsChecked = false;
      var tmpRankCheckedIndex = [];

      for (var i = 0; i < rankCheck.length; i++) {
        if (rankCheck[i].checked === true) {
          tmpIsChecked = true;
          tmpRankCheckedIndex.push(i);
        };
      };

      if (orgNameInput.value === "" || raceRoundsInput.value === "" || raceCoordInput.value === "" || raceDateInput === "" || tmpIsChecked === false) {
        dialog.showErrorBox("Missing Information", `Please make sure none of the fields are empty and that at least one rank is checked.`);
        //alert(`Please make sure none of the fields are empty and that at least one rank is checked.`);
        return;
      };

      //load the information into the global variable
      raceInformation["OrgName"] = orgNameInput.value;
      raceInformation["OrgType"] = orgTypeInput.value;
      raceInformation["RaceRounds"] = raceRoundsInput.value;
      raceInformation["RaceScoring"] = raceScoreInput.value;
      raceInformation["RaceCoordinator"] = raceCoordInput.value;
      raceInformation["RaceDate"] = raceDateInput.value;
      raceInformation["RacerStatsFile"] = racerStatsFile;
      raceInformation["RacerRanks"] = tmpRankCheckedIndex;

      //reset the form, keeping the select values
      orgNameInput.value = "";
      orgTypeInput.value = raceInformation.OrgType;
      loadRanks(raceInformation.OrgType);
      raceRoundsInput.value = "";
      raceScoreInput.value = raceInformation.RaceScoring;
      raceCoordInput.value = "";
      raceDateInput.value = "";
      editSideDialog.style.width = "0";

      updateRaceInfo();
      updateRacerStatsList();

      return;

    case "cancel":
      //empty the form and set back to defaults
      orgNameInput.value = "";
      orgTypeInput.value = "Cub Scout";
      loadRanks("Cub Scout");
      raceRoundsInput.value = "";
      raceScoreInput.value = "timed";
      raceCoordInput.value = "";
      raceDateInput.value = "";
      editSideDialog.style.width = "0";
      clearRacers();
      clearObject(raceInformation);
      updateRaceInfo();
      raceInfoFile = "";
      document.getElementById("RaceInfoFile").innerHTML = raceInfoFile.split('\\').pop().split('/').pop();


      return -1;

    case "close":
      editSideDialog.style.width = "0px";

      return -1;

  }

  editSideDialog.style.width = "700px";


}

function updateRaceInfo() {
  //update the div "RaceInfoDisplay"
  var raceInfoDiv = document.getElementById("RaceInfoDisplay");
  var racerInfoDiv = document.getElementById("RacerInfo");

  var tmpOutStr = "";
  var tempOutTable = "";;

  var tmpRanksNames = [];
  var tmpRacerStatsName = "";

  if (racerStatsFile !== raceInformation.RacerStatsFile) {
    clearObject(racerStats);
    racerStatsFile = raceInformation.RacerStatsFile;
  };

  if (isObjEmpty(racerStats) && (racerStatsFile !== undefined && racerStatsFile !== "" && racerStatsFile !== null)) {
    //if not loaded, load the racer stats file but first check to make sure the file exists 
    if (!fs.existsSync(racerStatsFile)) {
      dialog.showErrorBox("File Missing", `The file ${racerStatsFile} cannot be found.`)
    } else {
      var tmpData = fs.readFileSync(racerStatsFile);
      //parse the file and load into global variable
      racerStats = JSON.parse(tmpData);
      document.getElementById("racer-data-file").innerHTML = racerStatsFile.split('\\').pop().split('/').pop();
      updateRacerStatsList();

    }
  }

  if (racerStatsFile !== undefined && racerStatsFile !== "" && racerStatsFile !== null) {
    tmpRacerStatsName = racerStatsFile.split('\\').pop().split('/').pop();

  }

  if (!isObjEmpty(raceInformation)) {
    for (var i = 0; i < raceInformation.RacerRanks.length; i++) {
      tmpRanksNames[i] = rankTextPDT[raceInformation.RacerRanks[i]];
    };

    if (raceInformation.hasOwnProperty("race_finished")) {
      if (raceInformation.race_finished == true) {
        raceDone = true;
        raceRacers = JSON.parse(JSON.stringify(raceInformation.racer_table));
        //console.log(raceRacers);
        updateRacerTable();
        //console.log(raceRacers);
        tempOutTable = "<h2>Race Completed</h2>"
        tempOutTable += "<table id='mainRacerList'><tr><th>Car Number</th><th>Racer Name</th><th>Car Weight (oz)</th><th>Rank</th><th>Total Time (s)</th></tr>"
        for (var i = 0; i < raceRacers.length; i++) {
          tempOutTable += `<tr><td>${raceRacers[i].car}</td>`;
          tempOutTable += `<td>${raceRacers[i].racer_name}</td>`;
          tempOutTable += `<td>${raceRacers[i].weight}</td>`;
          tempOutTable += `<td>${raceRacers[i].rank}</td>`;
          tempOutTable += `<td>${(raceRacers[i].total_time).toFixed(4)}</td></tr>`;
        }

        tempOutTable += "</table>";

        racerInfoDiv.innerHTML = tempOutTable;
      }
    } else {
      raceDone = false;
      raceRacers.length = 0;
      updateRacerTable();

    }


    tmpOutStr = `<ul>`;
    tmpOutStr += `<span onclick="checkRaceDialog('edit')" class="faicon">&#xf040</span>`;
    tmpOutStr += `<span onclick="checkRaceDialog('cancel')" class="faicon">&#xf014</span>`;
    tmpOutStr += `<li>Organization Name: <b>${raceInformation.OrgName}</b></li>`;
    tmpOutStr += `<li>Organization Type: <b>${raceInformation.OrgType}</b></li>`;
    tmpOutStr += `<li>Ranks Included in Race: <b>${tmpRanksNames.join()}</b></li>`;
    tmpOutStr += `<li>Number of Rounds: <b>${raceInformation.RaceRounds}</b></li>`;
    tmpOutStr += `<li>Race Scoring Method: <b>${(raceInformation.RaceScoring === "timed" ? "Fastest Time" : "Point Elimination")}</b></li>`;
    tmpOutStr += `<li>Race Coordinator: <b>${raceInformation.RaceCoordinator}</b></li>`;
    tmpOutStr += `<li>Date of Race: <b>${raceInformation.RaceDate}</b></li>`;
    tmpOutStr += `<li>Racer Information File: <b>${tmpRacerStatsName}</b></li>`;
    tmpOutStr += `</ul>`;
  };

  numRounds = raceInformation.RaceRounds * 1;

  raceInfoDiv.innerHTML = tmpOutStr;
  displayResults();
  ipcRenderer.send('race-information', [raceInformation, numLanes]);
  return true;
}

function loadOptions() {
  //console.log("Loading the options/variable file");
  //load the config json file
  if (!fs.existsSync(`${__dirname}/config/default-config.json`)) {
    console.log("Cannot find the options/variable file");
    return -1;
  }
  var tmpData = fs.readFileSync(`${__dirname}/config/default-config.json`);
  optionsPDT = JSON.parse(tmpData);
  rankValuePDT = optionsPDT.OrgType[checkKeyValue(optionsPDT.OrgType, "name", "Cub Scout")].rank_value;
  rankTextPDT = optionsPDT.OrgType[checkKeyValue(optionsPDT.OrgType, "name", "Cub Scout")].rank_text;
  //load default options for cub scout organization
  loadSelect("RacerRank", rankValuePDT, "Tiger", rankTextPDT);
  loadSelect("OrgTypeSelect", getKeyValues(optionsPDT.OrgType, "name"), "Cub Scout");

  // create checkboxes for ranks in Race Info dialog
  createCheckList("orgRankInclude", "rank", rankTextPDT, rankValuePDT);
  //console.log("End of loadOptions");
}

function loadRanks(orgTypeTxt) {
  rankValuePDT = optionsPDT.OrgType[checkKeyValue(optionsPDT.OrgType, "name", orgTypeTxt)].rank_value;
  rankTextPDT = optionsPDT.OrgType[checkKeyValue(optionsPDT.OrgType, "name", orgTypeTxt)].rank_text;

  if (orgTypeTxt = "Cub Scout") {
    loadSelect("RacerRank", rankValuePDT, "Tiger", rankTextPDT);
  } else {
    loadSelect("RacerRank", rankValuePDT, rankValue[0], rankTextPDT);
  };

  createCheckList("orgRankInclude", "rank", rankTextPDT, rankValuePDT);
}

function createCheckList(divID, checkID, labelArr, checkValueArr) {
  var checkOutTxt = "";
  var divElement = document.getElementById(divID);

  for (var i = 0; i < labelArr.length; i++) {
    checkOutTxt += `<label for="${checkID}-${i}">${labelArr[i]}</label>`;
    checkOutTxt += `<input type="checkbox" id="${checkID}-${i}" value="${checkValueArr[i]}">`;
  }

  divElement.innerHTML = checkOutTxt;
}

function removeSelectOptions(obj) {
  while (obj.options.length) {
    obj.remove(0);
  }
}

function getKeyValues(objArr, key) {
  var tmpArr = [];
  if (Array.isArray(objArr)) {
    for (var i = 0; i < objArr.length; i++) {
      tmpArr.push(objArr[i][key]);
    }
    return tmpArr;
  }
  return -1;
}

function checkKeyValue(arrayObj, key, value) {
  if (Array.isArray(arrayObj)) {
    for (var i = 0; i < arrayObj.length; i++) {
      if (arrayObj[i][key] == value) {
        return i;
      }
    }
  }
  return -1;
}

function isObjEmpty(obj) {
  for (var x in obj) { if (obj.hasOwnProperty(x)) return false; }
  return true;
}

function clearObject(Obj) {
  for (var j in Obj) {
    if (Obj.hasOwnProperty(j)) {
      delete Obj[j];
    };
  }
  if (Obj.length > 0) {
    Obj.length = 0;
  }
}