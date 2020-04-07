/**
 * functions needed
 */

let poker = require('../poker-logic/lib/node-poker');

// could probably make this a proper db at some point
// maps sessionid -> {table, hostname, hoststack, seatsTaken, gameInProgress}
let tables = {};

// maps sessionid -> playerName -> { playerid, seat }
let playerids = {}

let createNewTable = (sessionid, smallBlind, bigBlind, hostName, hostStack, playerid) => {
    let table = new poker.Table(smallBlind, bigBlind, 2, 10, 1, 500000000);
    tables[sessionid] = {
        table: table,
        hostName: hostName,
        hostStack: hostStack,
        seatsTaken: [false, false, false, false, false, false, false, false, false, false],
        leavingGame: [false, false, false, false, false, false, false, false, false, false],
        allIn: [false, false, false, false, false, false, false, false, false, false],
        gameInProgress: false 
    };
    table.AddPlayer(hostName, hostStack, getAvailableSeat(sessionid));
    addToPlayerIds(sessionid, hostName, playerid);
}

let addToPlayerIds = (sessionid, playerName, playerid) => {
    let tempObj = playerids[sessionid] || {};
    tempObj[playerName] = {
        playerid: playerid,
        seat: getAvailableSeat(sessionid)
    };
    playerids[sessionid] = tempObj;
    tables[sessionid].seatsTaken[getAvailableSeat(sessionid)] = true;
}

// adds the player to the sid -> name -> pid map
// adds the player to the table
let buyin = (sessionid, playerName, playerid, stack) => {
    let seat = getAvailableSeat(sessionid);
    if (getAvailableSeat(sessionid) > -1){
        addToPlayerIds(sessionid, playerName, playerid);
        // console.log(tables[sessionid]);
        tables[sessionid].table.AddPlayer(playerName, stack, seat);
        console.log(`${playerName} buys in for ${stack} at seat ${seat}`);
        return true;
    } else {
        console.log('no seats available');
        return false;
    }
}

let removePlayer = (sessionid, playerName) => {
    tables[sessionid].table.removePlayer(playerName);
    // console.log(tables[sessionid])
    tables[sessionid].leavingGame[playerids[sessionid][playerName].seat] = true;
    // console.log(tables[sessionid])
    // console.log(playerids);
    delete playerids[sessionid][playerName];
    // console.log(playerids);
    if (playerName === tables[sessionid].hostName){
        // transfer host name / abilities to next player
        transferHost(sessionid, '');
    }
}

let transferHost = (sid, newHostName) => {
    console.log(playerids[sid]);
    if (newHostName in playerids[sid]){
        tables[sid].hostName = newHostName;
        tables[sid].hostStack = getStack(sid, newHostName);
        console.log('succesfully transferred host to ' + newHostName);
        return true;
    }
    for (let playerName of Object.keys(playerids[sid])) {
        // console.log(key + " -> " + playerids[sid][key]);
        tables[sid].hostName = playerName;
        tables[sid].hostStack = getStack(sid, playerName);
        console.log('transferred host to ' + playerName);
        return true;
        
    }
    tables[sid].hostName = null; 
    tables[sid].hostStack = null; 
    console.log('no player to transfer game to :(');
    return false;
}

let makeEmptySeats = (sid) => {
    for (let i = 0; i < tables[sid].leavingGame.length; i++){
        if (tables[sid].leavingGame[i]){
            tables[sid].seatsTaken[i] = false;
            tables[sid].leavingGame[i] = false;
        }
    }
}

let checkAllIns = (sid) => {
    let players = tables[sid].table.players;
    for (let i = 0; i < players.length; i++){
        tables[sid].allIn[getPlayerSeat(sid, players[i].playerName)] = players[i].allIn;
    }
    console.log(tables[sid].allIn);
    return tables[sid].allIn;
}

let getLosers = (sid) => {
    let losers = tables[sid].table.getLosers();
    console.log('losers!');
    console.log(losers);
    return losers;
}

let getTableById = (id) => tables[id];

let getPlayerId = (sid, playerName) => playerids[sid][playerName].playerid;

let getModId = (sid) => {
    if (tables[sid].hostName != null){
        return getPlayerId(sid, tables[sid].hostName);
    } else {
        return null;
    }
}

let getPlayerById = (sid, pid) => {
    // let t = tables[sid].table;
    for (name in playerids[sid]){
        if (playerids[sid][name].playerid == pid){
            return name;
        }
    }
    return 'guest';
}
let getPlayerSeat = (sid, playerName) => {
    if (playerids[sid][playerName])
        return playerids[sid][playerName].seat;
    else 
        return -1;
};

let updatePlayerId = (sid, playerName, playerid) => playerids[sid][playerName].playerid = playerid;

let getAvailableSeat = (sid) => {
    for (let i = 0; i < tables[sid].seatsTaken.length; i++){
        if (!tables[sid].seatsTaken[i]){
            return i;
        }    
    }
    return -1;
}

// returns a list of {playerName, seat, stack}
let playersInfo = (sid) => {
    let info = [];
    // console.log(getTableById(sid).table);
    // console.log(playerids[sid]);
    for (name in playerids[sid]){
        // console.log(name);
        // console.log(playerids[sid][name].seat);
        // console.log(getStack(sid, name));
        let isWaiting = false;
        for (let i = 0; i < getTableById(sid).table.playersToAdd.length; i++){
            // console.log('here!');
            if (name === getTableById(sid).table.playersToAdd[i].playerName){
                isWaiting = true;
                break;
            }
        }
        info.push({
            playerName: name,
            seat: playerids[sid][name].seat,
            stack: getStack(sid, name),
            playerid: playerids[sid][name].playerid,
            waiting: isWaiting
        })
    }
    // console.log(info);
    return info;
}

let getStack = (sid, playerName) => {
    let table = getTableById(sid).table;
    for (let i = 0; i < table.players.length; i++){
        if (table.players[i].playerName == playerName){
            return (table.players[i].chips);
        }
    }
    for (let i = 0; i < table.playersToAdd.length; i++){
        if (table.playersToAdd[i].playerName == playerName){
            return (table.playersToAdd[i].chips);
        }
    }
    return -1;
}

let startGame = (sid) => {
    tables[sid].gameInProgress = true;
    tables[sid].table.StartGame();
}

let startRound = (sid) => {
    tables[sid].table.initNewRound();
    if (!tables[sid].table.game)
        tables[sid].gameInProgress = false;
}

let getCardsByPlayerName = (sid, playerName) => tables[sid].table.getHandForPlayerName(playerName);

let getActionSeat = (sid) => {
    if (gameInProgress(sid)){
        let name = tables[sid].table.getCurrentPlayer();
        return playerids[sid][name].seat;
    } else {
        return -1;
    }
}

let getDealerSeat = (sid) => {
    // console.log('GET DEALER');
    // console.log(tables[sid].table);
    // console.log('----------');
    if (gameInProgress(sid)) {
        let dealerIndex = tables[sid].table.dealer;
        let seat = 0;
        for (let i = 0; i < tables[sid].seatsTaken.length; i++){
            if (tables[sid].seatsTaken[i] && seat == dealerIndex){
                console.log(`DEALER INDEX: ${dealerIndex}, SEAT: ${i}`);
                return i;
            } else if (tables[sid].seatsTaken[i]){
                seat++;
            }
        } 
        // console.log(tables[sid].table.bets);
    } else {
        return -1;
    }
}

let gameInProgress = (sid) => tables[sid].gameInProgress;

let getPot = (sid) => gameInProgress(sid) ? tables[sid].table.game.pot : 0;

let checkwin = (sid) => tables[sid].table.checkwin();

let getRoundName = (sid) => {
    if (gameInProgress(sid)){
        return tables[sid].table.game.roundName.toLowerCase();
    } else {
        return 'deal';
    }
}

let getDeal = (sid) => {
    return tables[sid].table.getDeal();
}

let call = (sid, playerName) => {
    // tables[sid].table.call(tables[sid].table.getCurrentPlayer());
    tables[sid].table.call(playerName);
}

let check = (sid, playerName) => {
    // return tables[sid].table.check(tables[sid].table.getCurrentPlayer());
    return tables[sid].table.check(playerName);
}

let fold = (sid, playerName) => {
    // return tables[sid].table.fold(tables[sid].table.getCurrentPlayer());
    return tables[sid].table.fold(playerName);
}

let bet = (sid, playerName, betAmount) => {
    // return tables[sid].table.bet(tables[sid].table.getCurrentPlayer(), betAmount);
    return tables[sid].table.bet(playerName, betAmount);
}

let getWinnings = (sid, prev_round) => {
    console.log('calculating winnings');
    let winnings = tables[sid].table.game.pot;
    if (prev_round === 'deal') {
        //basically check if any bets are still on the table and add them to the pot (for big blind, etc)
        for (let i = 0; i < tables[sid].table.game.bets.length; i++) {
            let bet = tables[sid].table.game.bets[i];
            winnings += bet;
        }
    }
    return winnings;
}

let updateStack = (sid, playerName, winnings) => {
    tables[sid].table.getPlayer(playerName).GetChips(winnings);
}

let getMaxBet = (sid) => {
    let maxBet = 0;
    let bets = tables[sid].table.game.bets;
    for (let i = 0; i < bets.length; i ++) {
        if (bets[i] > maxBet) {
            maxBet = bets[i];
        }
    }
    return maxBet;
}

let getNameByActionSeat = (sid) => {
    let seat = getActionSeat(sid);
    for (name in playerids[sid]) {
        if (playerids[sid][name].seat == seat) {
            return name;
        }
    }
    return 'guest';
}

// return an array of seat, bet objects
// may lead to a bug down the line still unsure
let getInitialBets = (sid) => {
    let bets = tables[sid].table.game.bets;
    let toReturn = [];
    for (let i = 0; i < bets.length; i++){
        let obj = {
            seat: 'guest',
            bet: 0
        }
        if (bets[i]){
            obj.bet = bets[i];
            let seatsTaken = getTableById(sid).seatsTaken;
            let counter = 0;
            for (let j = 0; j < seatsTaken.length; j++){
                if (seatsTaken[j]){
                    if (counter === i){
                        obj.seat = j;
                        break;
                    } else {
                        counter++;
                    }
                }
            }
            toReturn.push(obj);
        }
    }
    return toReturn;
}

let getWinners = (sid) => {
    let winners = getTableById(sid).table.getWinners();
    for (let i = 0; i < winners.length; i++){
        winners[i].seat = getPlayerSeat(sid, winners[i].playerName);
    }
    return winners;
}

let getAvailableActions = (sid) => {
    if (gameInProgress(sid) && getMaxBet(sid)){
        return {
            'min-bet': false,
            'bet': false,
            'raise': true,
            'fold': true,
            'call': true,
            'start': false,
            'check': false
        };
    } else if (gameInProgress(sid)){
        return {
            'min-bet': true,
            'bet': true,
            'raise': false,
            'fold': true,
            'call': false,
            'start': false,
            'check': true
        };
    } else {
        return {
            'min-bet': false,
            'bet': false,
            'raise': false,
            'fold': false,
            'call': false,
            'start': true,
            'check': false
        };
    }
}

module.exports.createNewTable = createNewTable;
module.exports.getTableById = getTableById;
module.exports.buyin = buyin;
module.exports.removePlayer = removePlayer;
module.exports.makeEmptySeats = makeEmptySeats;
module.exports.getPlayerId = getPlayerId;
module.exports.getPlayerById = getPlayerById;
module.exports.getPlayerSeat = getPlayerSeat;
module.exports.updatePlayerId = updatePlayerId;
// module.exports.getAvailableSeat = getAvailableSeat;
module.exports.playersInfo = playersInfo;
module.exports.getStack = getStack;
module.exports.startGame = startGame;
module.exports.startRound = startRound;
module.exports.getCardsByPlayerName = getCardsByPlayerName;
module.exports.getActionSeat = getActionSeat;
module.exports.getDealerSeat = getDealerSeat;
module.exports.gameInProgress = gameInProgress;
module.exports.getPot = getPot;
module.exports.getRoundName = getRoundName;
module.exports.getDeal = getDeal;
module.exports.call = call;
module.exports.check = check;
module.exports.fold = fold;
module.exports.bet = bet;
module.exports.checkwin = checkwin;
module.exports.getWinnings = getWinnings;
module.exports.updateStack = updateStack;
module.exports.getMaxBet = getMaxBet;
module.exports.getNameByActionSeat = getNameByActionSeat;
module.exports.getInitialBets = getInitialBets;
module.exports.getWinners = getWinners;
module.exports.getLosers = getLosers;
module.exports.getModId = getModId;
module.exports.checkAllIns = checkAllIns;
module.exports.getAvailableActions = getAvailableActions;