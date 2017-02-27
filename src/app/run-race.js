var raceResults = [];
var currentHeatNum = 0;
var currentRnd = 0;
var roundResults = [];
var NumHeats = 0;
var raceRacers = [];
var isRacing = false;
var raceDone = false;

function specWin(command) {
  ipcRenderer.send('spectator-window', command);
}

function stopRace() {
  var resp = confirm("Are you sure you want to stop the race?  All results will be deleted.");
  if (!resp) { return -1 };

  isRacing = false;

  //change the stop race button back to a start race button
  var startButton = document.getElementById("start-race");
  startButton.innerHTML = "Start Race";
  startButton.setAttribute("onclick", "setupRace()");

  var heatButton = document.getElementById("heat-button");
  var redoHeatButton = document.getElementById("redo-heat");
  var saveResultsButton = document.getElementById("save-results");

  disableButtons([heatButton, redoHeatButton, saveResultsButton]);


  //re-enable all buttons in other tabs but the serial command send button
  var mainButtons = document.getElementById("mainT").getElementsByTagName("button");
  disableButtons(mainButtons);

  var testButtons = document.getElementById("testTrackT").getElementsByTagName("button");
  disableButtons(testButtons);
  disableButtons([document.getElementById("send-serial")]);

  var editButtons = document.getElementById("editRacersT").getElementsByTagName("button");
  disableButtons(editButtons);

  clearDisplay();
  clearObject(raceRacers);
  clearObject(raceResults);
  ipcRenderer.send('stop-race', [raceResults, raceRacers]);
  updateRacerTable();

  var heatTable = document.getElementById("heat-lane-assignments").getElementsByTagName("table");
  heatTable[0].innerHTML = "";

  var roundTxt = document.getElementById("current-round-number");
  var heatTxt = document.getElementById("current-heat-number");
  var roundTable = document.getElementById("round-lineup-table");

  roundTxt.innerHTML = "";
  heatTxt.innerHTML = "";
  roundTable.innerHTML = "";



}

function setupRace() {
  if (isObjEmpty(raceInformation) || raceDone == true) {
    dialog.showMessageBox(remote.getCurrentWindow(), {
      title: "Race File Missing or Race Completed",
      type: "warning",
      buttons: ["Ok"],
      message: "Please open/create a new race file first before trying to start a race."
    })
    clickMenuTab(0);
    return -1;
  }

  currentHeatNum = 1;
  currentRnd = 1;
  isRacing = true;

  var heatButton = document.getElementById("heat-button");
  var redoHeatButton = document.getElementById("redo-heat");
  var saveRaceButton = document.getElementById("save-results");

  heatButton.disabled = true;
  redoHeatButton.disabled = true;

  saveRaceButton.disabled = true;

  //change the start race button to a stop race button
  var startButton = document.getElementById("start-race");
  startButton.innerHTML = "Stop Race";
  startButton.setAttribute("onclick", "stopRace()");

  //disable all buttons in other tabs but the serial command send button
  var mainButtons = document.getElementById("mainT").getElementsByTagName("button");
  disableButtons(mainButtons);

  var testButtons = document.getElementById("testTrackT").getElementsByTagName("button");
  disableButtons(testButtons);
  disableButtons([document.getElementById("send-serial")]);

  var editButtons = document.getElementById("editRacersT").getElementsByTagName("button");
  disableButtons(editButtons);
  clearDisplay();

  //generate the round and store in an array
  generateRound(includedRacers.length, numLanes, currentRnd, raceRacers);

  updateRoundTable(raceResults, currentRnd, currentHeatNum, numLanes, NumHeats, numRounds);
  updateCurrentHeat(raceResults, currentRnd, numLanes, currentHeatNum);

  ipcRenderer.send('setup-race', [raceResults, raceRacers, currentRnd, currentHeatNum, NumHeats]);
}

function generateRound(nRacers, nLanes, RndNo, racerArray) {
  /*
  nRacers - number of racers in race
  nLanes - number of lanes on track
  RndNo - current round number
  racerArray - array containing only the racers in the race - follows the same structure as racerStats
  */

  var Remainder = (nRacers * 1) % (nLanes * 1);

  if (Remainder == 0) {
    var Blank = 0;
  } else {
    var Blank = (nLanes * 1) - Remainder;
  };

  NumHeats = ((nRacers * 1) + (Blank * 1)) / (nLanes * 1);

  //if it is the first round, then we have to do some initial setup
  if (RndNo == 1) {
    var order = genRandomNumArray((NumHeats * nLanes), 0, (nRacers + Blank - 1));

    //make sure the array is empty
    clearObject(raceResults);

    //initialize the array
    raceResults[RndNo * 1 - 1] = [];
    for (var l = 0; l < nLanes; l++) { // # of lanes
      raceResults[RndNo * 1 - 1][l] = [];
      for (var h = 0; h < NumHeats; h++) { // # of heats
        raceResults[RndNo * 1 - 1][l][h] = {};
      }
    }

    //fill the array
    var j = 0; // j is heat #
    for (var i = 0; i < order.length; i = i + nLanes * 1) {
      for (var x = 0; x < nLanes; x++) {  // x is the lane #
        if (!isObjEmpty(racerArray[order[i + x]])) {
          raceResults[RndNo * 1 - 1][x][j].car = racerArray[order[i + x]].car;
          raceResults[RndNo * 1 - 1][x][j].racer_name = racerArray[order[i + x]].racer_name;
          raceResults[RndNo * 1 - 1][x][j].total_time = 0;
          raceResults[RndNo * 1 - 1][x][j].heat_time = 0;
          raceResults[RndNo * 1 - 1][x][j].heat_lane = x;
          raceResults[RndNo * 1 - 1][x][j].race_index = order[i + x];
          raceResults[RndNo * 1 - 1][x][j].main_index = checkKeyValue(racerStats, "car", raceRacers[order[i + x]].car);
        } else {
          raceResults[RndNo * 1 - 1][x][j].car = "-";
          raceResults[RndNo * 1 - 1][x][j].racer_name = "No Racer";
          raceResults[RndNo * 1 - 1][x][j].total_time = 0;
          raceResults[RndNo * 1 - 1][x][j].heat_time = 0;
          raceResults[RndNo * 1 - 1][x][j].heat_lane = x;
          raceResults[RndNo * 1 - 1][x][j].race_index = 99;
          raceResults[RndNo * 1 - 1][x][j].main_index = 99;
        }
      }
      j++;
    }
  } else {
    //after first round, we need to swap lanes so each racers races on each lane, then we need
    //to sort the lanes so that the fastest cars are at the top for the next round
    raceResults[RndNo - 1] = [];

    // swap the lane arrays from the old round [RndNo-2] into the new round array [RndNo-1]
    var l = 0;
    for (var i = 0; i < nLanes; i++) {
      if ((i + 1) == nLanes) {
        l = 0;
      } else {
        var l = i + 1;
      }
      raceResults[RndNo - 1][l] = JSON.parse(JSON.stringify(raceResults[RndNo - 2][i].slice()));
    }
    // now let's sort the new round array lanes by total_time
    for (var l = 0; l < nLanes; l++) {
      raceResults[RndNo - 1][l].sort(function (a, b) {
        return a.total_time - b.total_time;
      })
    }

    // now reset the lane # and heat time for each car
    for (var l = 0; l < nLanes; l++) {
      for (var h = 0; h < NumHeats; h++) {
        raceResults[RndNo - 1][l][h].heat_lane = l;
        raceResults[RndNo - 1][l][h].heat_time = 0;
      }
    }
  }
}

function updateRoundTable(resultsArr, RndNo, HeatNo, nLanes, numberHeats, numberRounds) {
  /*
  resultsArr - nested array created by generateRound() with [round][lane][heat] plus object with
  {car, racer_name, total_time, heat_time, heat_lane, race_index, main_index}
      - race_index is the index of the entry in raceRacers array
      - main_index is the index of the entry in the racerStats array
  RndNo - current round number
  HeatNo - current heat number
  nLanes - number of lanes
  numberHeats - number of heats in round
  numberROunds - number of rounds in race
  */
  var currentRoundDiv = document.getElementById("current-round");

  if (document.getElementById("current-round-number") == null) {
    var tmpTxt = "";
    tmpTxt += "<div class='flex-title'>\n";
    tmpTxt += "<h2>Round: <span id='current-round-number'></span></h2>\n";
    tmpTxt += "<h2>Heat: <span id='current-heat-number'></span></h2>\n";
    tmpTxt += "</div>\n";
    tmpTxt += "<table id='round-lineup-table'></table>\n";
    currentRoundDiv.innerHTML = tmpTxt;
  }
  var roundTxt = document.getElementById("current-round-number");
  var heatTxt = document.getElementById("current-heat-number");
  var roundTable = document.getElementById("round-lineup-table");
  var headerTxt1a = "<tr><th rowspan=2>Heat #</th>";
  var headerTxt1b = "";
  var headerTxt1c = "</tr>";
  var headerTxt2base = "<th>Car #</th><th>Heat Time</th>";
  var headerTxt2 = ""

  var tempOut = "";

  //set the round and heat
  roundTxt.innerHTML = `${RndNo} / ${numberRounds}`;
  heatTxt.innerHTML = `${HeatNo} / ${numberHeats}`;

  //build the table header
  for (var i = 1; i <= nLanes; i++) {
    headerTxt1b += `<th colspan=2>Lane ${i}</th>`
    headerTxt2 += headerTxt2base;
  }
  tempOut += headerTxt1a + headerTxt1b + headerTxt1c;
  tempOut += `<tr>${headerTxt2}</tr>`;

  for (var h = 0; h < numberHeats * 1; h++) {  // h is the heat #
    tempOut += `<tr><td>${(h + 1)}</td>`;
    for (var l = 0; l < nLanes; l++) {             // l is the lane #
      if (resultsArr[RndNo - 1][l][h].car !== "-") {
        tempOut += `<td>${resultsArr[RndNo - 1][l][h].car}</td><td>${resultsArr[RndNo - 1][l][h].heat_time}</td>`;
      } else {
        tempOut += `<td>No Racer</td><td>-</td>`;
      }
    }
    tempOut += "</tr>";
  }
  roundTable.innerHTML = tempOut;
}

function updateRacerTable() {
  var trOut = "";
  var racerTmpTable = document.getElementById("racer-table");

  //load an array with just the included racerStats
  if (isObjEmpty(raceRacers)) {
    for (var i = 0; i < includedRacers.length; i++) {
      raceRacers[i] = {};

      for (var keys in racerStats[includedRacers[i]]) {
        raceRacers[i][keys] = racerStats[includedRacers[i]][keys];
      }
    }
  }

  trOut += "<tr><th>Car<br/>#</th><th>Racer Name</th><th>Racer<br/>Rank</th><th>Total<br/>Time (s)</th></tr>";

  for (var i = 0; i < raceRacers.length; i++) {
    trOut += `<tr><td>${raceRacers[i].car}</td>`;
    trOut += `<td>${raceRacers[i].racer_name}</td>`;
    trOut += `<td>${raceRacers[i].rank}</td>`;
    trOut += `<td>${(raceRacers[i].total_time).toFixed(4)}</td></tr>`;
  }

  racerTmpTable.innerHTML = trOut;
}

function updateCurrentHeat(resultsArr, RndNo, nLanes, currentHeatNo) {
  var heatTable = document.getElementById("heat-lane-assignments").getElementsByTagName("table");
  var tableOut = "";
  var headerTxt1 = `<th colspan="${nLanes * 2}">Current Heat Lineup</th>`;
  var headerTxt2 = "";
  var headerTxt3base = "<th>Car #</th><th>Racer</th>";
  var headerTxt3 = "";

  //create the correct # of lanes in the table
  for (var i = 1; i <= nLanes; i++) {
    headerTxt2 += `<th colspan="2">Lane ${i}</th>`
    headerTxt3 += headerTxt3base;
  }

  tableOut += `<tr>${headerTxt1}</tr>`;
  tableOut += `<tr>${headerTxt2}</tr>`;
  tableOut += `<tr>${headerTxt3}</tr>`;

  if (typeof resultsArr == undefined || resultsArr == null || resultsArr.length == 0) {
    heatTable[0].innerHTML = tableOut;

    return -1;
  }

  //lets make sure all the lanes masks are cleared
  for (var l = 0; l < nLanes; l++) {
    document.getElementById(`race-lane-mask${l + 1}`).checked = false;
  }
  setMask("race-lane");

  tableOut += `<tr>`;
  for (var l = 0; l < nLanes; l++) {  // l is # of lanes
    //set lane mask
    if (resultsArr[RndNo - 1][l][currentHeatNo - 1].car == "-") {
      document.getElementById(`race-lane-mask${l + 1}`).checked = true;
      setMask("race-lane");
    }
    tableOut += `<td>${resultsArr[RndNo - 1][l][currentHeatNo - 1].car}</td><td>${resultsArr[RndNo - 1][l][currentHeatNo - 1].racer_name}</td>`;
  }
  tableOut += `</tr>`;

  heatTable[0].innerHTML = tableOut;
  return 1;
}

function raceUpdate(type) {
  var heatButton = document.getElementById("heat-button");
  var redoHeatButton = document.getElementById("redo-heat");
  var saveResultsButton = document.getElementById("save-results");
  var startButton = document.getElementById("start-race");

  var currentWindowObj = remote.getCurrentWindow();


  switch (type) {
    case "accept":
      redoHeatButton.disabled = true;
      if (currentHeatNum !== NumHeats) {
        heatButton.innerHTML = "Next Heat";
        heatButton.setAttribute('onclick', "raceUpdate('next')");
      } else if (currentRnd !== numRounds) {
        heatButton.innerHTML = "Next Round";
        heatButton.setAttribute('onclick', "raceUpdate('next')");
      } else {
        var response = dialog.showMessageBox(currentWindowObj, {
          type: "question",
          buttons: ["Yes, do a final race.", "No, just show the results."],
          title: "Championship Round?",
          message: `Do you want the top ${numLanes} finishers to race in a championship round?`,
          icon: PDTimage
        });
        if (response == 1) {
          heatButton.innerHTML = "Finish";
          heatButton.setAttribute('onclick', "raceUpdate('finish')");
        } else if (response == 0) {
          heatButton.innerHTML = "Accept Final Results";
          heatButton.setAttribute('onclick', "raceUpdate('final')");
          createChampRound();
          return;
        }
      }

      // let's make sure laneTimes is in the correct order, so sort laneTimes by lane #
      laneTimes.sort(function (a, b) {
        return a.lane - b.lane;
      })

      for (var l = 0; l < numLanes; l++) {
        raceResults[currentRnd - 1][l][currentHeatNum - 1].heat_time = laneTimes[l].time * 1;
        raceResults[currentRnd - 1][l][currentHeatNum - 1].total_time += laneTimes[l].time * 1;
        if (raceResults[currentRnd - 1][l][currentHeatNum - 1].race_index != 99) {
          raceRacers[raceResults[currentRnd - 1][l][currentHeatNum - 1].race_index].total_time += laneTimes[l].time * 1;
        }
      }
      updateRacerTable();
      updateRoundTable(raceResults, currentRnd, currentHeatNum, numLanes, NumHeats, numRounds);

      ipcRenderer.send('update-information', [raceResults, raceRacers, currentRnd, currentHeatNum, NumHeats]);

      break;

    case "redo":
      clearDisplay();
      heatButton.disabled = true;
      redoHeatButton.disabled = true;
      ipcRenderer.send('redo');
      //resetArduino();

      break;

    case "next":
      clearDisplay();
      if (currentHeatNum !== NumHeats) {
        currentHeatNum++;
      } else if (currentRnd !== numRounds) {
        currentHeatNum = 1;
        currentRnd++;
        generateRound(raceRacers.length, numLanes, currentRnd, raceRacers);
      } else {
        //currentRnd = 1;
        //currentHeatNum = 1;
        return;
      }
      updateRacerTable();
      updateRoundTable(raceResults, currentRnd, currentHeatNum, numLanes, NumHeats, numRounds);
      updateCurrentHeat(raceResults, currentRnd, numLanes, currentHeatNum);
      heatButton.disabled = true;
      redoHeatButton.disabled = true;

      heatButton.innerHTML = "Accept Heat Results";
      heatButton.setAttribute('onclick', "raceUpdate('accept')");

      ipcRenderer.send('next', [raceResults, raceRacers, currentRnd, currentHeatNum, NumHeats]);

      break;

    case "finish":
      clearDisplay();
      isRacing = false;
      raceDone = true;
      //let's sort the array by total_time
      raceRacers.sort(function (a, b) {
        return a.total_time - b.total_time;
      });
      updateRacerTable();
      ipcRenderer.send('winner-no-extra', [raceResults, raceRacers, currentRnd, currentHeatNum, NumHeats]);

      var resultsDiv = document.getElementById("current-round");

      var resultsTxt = "<h1>Winners</h1><ul>";
      var placeTxt = ""

      for (var i = 0; i < 3; i++) {
        if (i == 0) {
          placeTxt = "1st";
        } else if (i == 1) {
          placeTxt = "2nd";
        } else if (i == 2) {
          placeTxt = "3rd";
        } else {
          placeTxt = `${i + 1}th`;
        }
        resultsTxt += `<li>${placeTxt} Place - ${raceRacers[i].racer_name} / Car #: ${raceRacers[i].car} (${(raceRacers[i].total_time).toFixed(4)} s)</li>`
      }
      resultsTxt += "</ul>";

      resultsDiv.innerHTML = resultsTxt;

      startButton.innerHTML = "Start Race"
      startButton.setAttribute('onclick', "setupRace()");

      heatButton.innerHTML = "Accept Heat Results";
      heatButton.setAttribute('onclick', "raceUpdate('accept')");

      heatButton.disabled = true;
      saveResultsButton.disabled = false;
      startButton.disabled = true;
      var heatTable = document.getElementById("heat-lane-assignments").getElementsByTagName("table");
      heatTable[0].innerHTML = "";

      break;

    case "final":
      isRacing = false;
      raceDone = true;
      redoHeatButton.disabled = true;

      // let's make sure laneTimes is in the correct order, so sort laneTimes by lane #
      laneTimes.sort(function (a, b) {
        return a.lane - b.lane;
      })
      //save results only into raceResults array push into a temp array to determine final winners
      var raceTmpArr = [];
      for (var l = 0; l < numLanes; l++) {
        raceResults[numRounds][l][0].heat_time = laneTimes[l].time * 1;
        raceTmpArr[l] = {};
        raceTmpArr[l].car = raceResults[numRounds][l][0].car;
        raceTmpArr[l].heat_time = raceResults[numRounds][l][0].heat_time;
      }

      //let's sort the arrays by total_time or heat_time
      raceRacers.sort(function (a, b) {
        return a.total_time - b.total_time;
      });

      raceTmpArr.sort(function (a, b) {
        return a.heat_time - b.heat_time;
      })
      var resultsDiv = document.getElementById("current-round");

      var resultsTxt = "<h1>Winners</h1><ul>";
      var placeTxt = "";

      if (raceTmpArr.length < 3) {
        raceTmpArr[2] = {};
        raceTmpArr[2].car = raceRacers[2].car;
        raceTmpArr[2].racer_name = raceRacers[2].racer_name;
        raceTmpArr[2].rank = raceRacers[2].rank;
        raceTmpArr[2].heat_time = raceRacers[2].total_time;
      }

      for (var i = 0; i < raceTmpArr.length; i++) {
        if (i == 0) {
          placeTxt = "1st";
        } else if (i == 1) {
          placeTxt = "2nd";
        } else if (i == 2) {
          placeTxt = "3rd";
        } else {
          placeTxt = `${i + 1}th`;
        }

        resultsTxt += `<li>${placeTxt} Place - ${raceRacers[checkKeyValue(raceRacers, "car", raceTmpArr[i].car)].racer_name} / Car #: ${raceTmpArr[i].car} (${(raceTmpArr[i].heat_time).toFixed(4)} s)</li>`;
      }

      resultsTxt += "</ul>";

      resultsDiv.innerHTML = resultsTxt;

      updateRacerTable();
      clearDisplay();

      ipcRenderer.send('winner-extra', [raceResults, raceRacers, currentRnd, currentHeatNum, NumHeats, raceTmpArr]);

      startButton.innerHTML = "Start Race"
      startButton.setAttribute('onclick', "setupRace()");

      heatButton.innerHTML = "Accept Heat Results";
      heatButton.setAttribute('onclick', "raceUpdate('accept')");

      heatButton.disabled = true;
      saveResultsButton.disabled = false;
      startButton.disabled = true;
      var heatTable = document.getElementById("heat-lane-assignments").getElementsByTagName("table");
      heatTable[0].innerHTML = "";

      break;

    default:
      break;
  }
}

function createChampRound() {
  var heatButton = document.getElementById("heat-button");
  var redoHeatButton = document.getElementById("redo-heat");
  var saveResultsButton = document.getElementById("save-results");
  var startButton = document.getElementById("start-race");

  //first load final results to array

  laneTimes.sort(function (a, b) {
    return a.lane - b.lane;
  })

  for (var l = 0; l < numLanes; l++) {
    raceResults[currentRnd - 1][l][currentHeatNum - 1].heat_time = laneTimes[l].time * 1;
    if (raceResults[currentRnd - 1][l][currentHeatNum - 1].race_index != 99) {
      raceRacers[raceResults[currentRnd - 1][l][currentHeatNum - 1].race_index].total_time += laneTimes[l].time * 1;
    }
  }

  ipcRenderer.send('update-information', [raceResults, raceRacers, currentRnd, currentHeatNum, NumHeats]);

  //next create temp array so we can see the top finishers
  var raceTmpArr = JSON.parse(JSON.stringify(raceRacers));

  //sort the temp array
  raceTmpArr.sort(function (a, b) {
    return a.total_time - b.total_time;
  })

  //now create new entry in raceResults for final round with one heat
  raceResults[numRounds] = [];
  for (var l = 0; l < numLanes; l++) {
    raceResults[numRounds][l] = [];
    raceResults[numRounds][l][0] = {};
    raceResults[numRounds][l][0].car = raceTmpArr[l].car;
    raceResults[numRounds][l][0].racer_name = raceTmpArr[l].racer_name;
    raceResults[numRounds][l][0].heat_time = 0;
    raceResults[numRounds][l][0].heat_lane = l;
    raceResults[numRounds][l][0].race_index = checkKeyValue(raceRacers, "car", raceTmpArr[l].car);
    raceResults[numRounds][l][0].main_index = checkKeyValue(racerStats, "car", raceTmpArr[l].car);
  }

  updateRacerTable();
  updateRoundTable(raceResults, (numRounds + 1), 1, numLanes, 1, (numRounds + 1));
  updateCurrentHeat(raceResults, (numRounds + 1), numLanes, 1);

  ipcRenderer.send('champ-round', [raceResults, raceRacers, (currentRnd + 1), 1, 1]);

  clearDisplay();
  heatButton.disabled = true;
  redoHeatButton.disabled = true;

}

function genRandomNumArray(entries, min, max) {
  // parameters
  // entries : how many numbers you want to generate. For example it is 5.
  // min(inclusive) : minimum/low value of a range. it must be any positive integer but less than max. i.e 4
  // max(inclusive) : maximun value of a range. it must be any positive integer. i.e 50
  // return type: array

  var random_number = [];
  for (var i = 0; i < entries; i++) {
    var gen_num = parseInt((Math.random() * (max - min + 1)) + min);
    do {
      var is_exist = random_number.indexOf(gen_num);
      if (is_exist >= 0) {
        gen_num = parseInt((Math.random() * (max - min + 1)) + min);
      }
      else {
        random_number.push(gen_num);
        is_exist = -2;
      }
    }
    while (is_exist > -1);
  }
  return random_number;
}

function disableButtons(buttonArr) {
  for (var i = 0; i < buttonArr.length; i++) {
    buttonArr[i].disabled === false ? buttonArr[i].disabled = true : buttonArr[i].disabled = false;
  }
}

function postResults(raceTimes) {
  var heatButton = document.getElementById("heat-button");
  var redoHeatButton = document.getElementById("redo-heat");
  var saveResultsButton = document.getElementById("save-results");
  var startButton = document.getElementById("start-race");

  heatButton.disabled = false;
  redoHeatButton.disabled = false;

  //send results to spectator window
  ipcRenderer.send('post-results', raceTimes);
}

function simHeat(nLanes) {
  for (var i = 0; i < nLanes; i++) {
    var rndTime = ((Math.random() * 3) + 1).toFixed(4);

    if (currentTab == "testTrackT") {
      var tempLaneId = `tlane-lane${i + 1}`;
    } else {
      var tempLaneId = `race-lane-lane${i + 1}`;
    }

    if (laneMask[i] != 1) {
      document.getElementById(tempLaneId).innerHTML = rndTime;
      laneTimes[i] = { lane: (i + 1), time: rndTime * 1 };
    } else {
      laneTimes[i] = { lane: (i + 1), time: 99 };
    }
  }

  laneTimes.sort(function (a, b) {
    return a.time - b.time;
  })

  if (currentTab == "testTrackT") {
    if (nLanes > 2) {
      var winnerLane = [`tlane-lane${laneTimes[0].lane}-Li`, `tlane-lane${laneTimes[1].lane}-Li`, `tlane-lane${laneTimes[2].lane}-Li`];
    } else {
      var winnerLane = [`tlane-lane${laneTimes[0].lane}-Li`, `tlane-lane${laneTimes[1].lane}-Li`];
    }
  } else {
    if (nLanes > 2) {
      var winnerLane = [`race-lane-lane${laneTimes[0].lane}-Li`, `race-lane-lane${laneTimes[1].lane}-Li`, `race-lane-lane${laneTimes[2].lane}-Li`];
    } else {
      var winnerLane = [`race-lane-lane${laneTimes[0].lane}-Li`, `race-lane-lane${laneTimes[1].lane}-Li`,];
    }
  }
  document.getElementById(winnerLane[0]).className = "winner1";
  document.getElementById(winnerLane[1]).className = "winner2";
  if (nLanes > 2) {
    document.getElementById(winnerLane[2]).className = "winner3";
  }
  if (currentTab == "testTrackT") {
    updateHistoryTable(laneTimes);
  }
  if (isRacing) {
    postResults(laneTimes);
  }
}

function saveResults() {
  var heatButton = document.getElementById("heat-button");
  var redoHeatButton = document.getElementById("redo-heat");
  var saveResultsButton = document.getElementById("save-results");
  var startButton = document.getElementById("start-race");
  var resultsDiv = document.getElementById("current-round");

  raceInformation["heat_results"] = JSON.parse(JSON.stringify(raceResults));
  raceInformation["number_lanes"] = numLanes;
  raceInformation["current_heat"] = currentHeatNum;
  raceInformation["current_round"] = currentRnd;
  raceInformation["number_heats"] = NumHeats;
  raceInformation["race_finished"] = raceDone;
  raceInformation["racer_table"] = JSON.parse(JSON.stringify(raceRacers));


  startButton.disabled = false;
  //enable all buttons in other tabs 
  var mainButtons = document.getElementById("mainT").getElementsByTagName("button");
  disableButtons(mainButtons);

  var testButtons = document.getElementById("testTrackT").getElementsByTagName("button");
  disableButtons(testButtons);
  disableButtons([document.getElementById("send-serial")]);

  var editButtons = document.getElementById("editRacersT").getElementsByTagName("button");
  disableButtons(editButtons);


  dialog.showSaveDialog(remote.getCurrentWindow(), {
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

      dialog.showMessageBox(remote.getCurrentWindow(), {
        title: "Race File Saved",
        type: "info",
        buttons: ["Ok"],
        message: `The file ${filenames.split('\\').pop().split('/').pop()} has been saved.`
      })
      if (raceDone == true) {
        clearObject(raceResults);
        clearObject(raceRacers);
        updateRacerTable();
        resultsDiv.innerHTML = "";
      }

    }

    /*if (raceInfoFile !== "") {
      if (!fs.existsSync(raceInfoFile)) {
        dialog.showErrorBox("File Missing", `The file ${raceInfoFile.split('\\').pop().split('/').pop()} cannot be found.`)
      } else {
        var contentJSON = JSON.stringify(raceInformation);

        //save txt
        fs.writeFileSync(raceInfoFile, contentJSON);
        dialog.showMessageBox(remote.getCurrentWindow(), {
          title: "Race File Saved",
          type: "info",
          buttons: ["Ok"],
          message: `The file ${raceInfoFile} has been saved.`
        })
      }
    }*/


  })
}

function displayResults() {
  var resultsDiv = document.getElementById("current-round");

  if (!raceInformation.hasOwnProperty("race_finished")) {
    resultsDiv.innerHTML = "";
    return;
  }
  // generate output for each round and heat
  var resultsDiv = document.getElementById("current-round");
  var resultsTxtOut = "";

  var headerTxt1a = "<tr><th rowspan=2>Heat #</th>";
  var headerTxt1b = "";
  var headerTxt1c = "</tr>";
  var headerTxt2base = "<th>Car #</th><th>Heat Time</th>";
  var headerTxt2 = "";


  //let's load the data from the main file into a temp variable;

  var resultsTmp = JSON.parse(JSON.stringify(raceInformation.heat_results));
  
  //build the table header for each round
  for (var i = 1; i <= raceInformation.number_lanes; i++) {
    headerTxt1b += `<th colspan=2>Lane ${i}</th>`
    headerTxt2 += headerTxt2base;
  }
  //now loop through the array and generate the output
  for (var r = 0; r < resultsTmp.length; r++) {
    resultsTxtOut += `<H2>Round: ${r + 1}</h2>`;
    resultsTxtOut += `<table>${headerTxt1a}${headerTxt1b}${headerTxt1c}<tr>${headerTxt2}</tr>`

    for (var h = 0; h < raceInformation.number_heats; h++) {
      resultsTxtOut += `<tr><td>${(h + 1)}</td>`;

      for (var l = 0; l < raceInformation.number_lanes; l++) {
        if (resultsTmp[r][l][h].car !== "-") {
          resultsTxtOut += `<td>${resultsTmp[r][l][h].car}</td><td>${resultsTmp[r][l][h].heat_time}</td>`;
        } else {
          resultsTxtOut += `<td>No Racer</td><td>-</td>`;
        }

      }
      resultsTxtOut += "</tr>"
    }
    resultsTxtOut += `</table>`;
  }

  resultsDiv.innerHTML = resultsTxtOut;
}

