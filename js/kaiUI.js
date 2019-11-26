/* eslint-disable */
/**
 * XLink Kai 7.4 WebUI.
 * Coded by prestige and maintained by the Team XLink dev team.
 */

var SID                 = null;
var countDebug          = 0;
var vectors             = {};
var allPlayers          = {};
var contacts            = {};
var admins              = '/';
var mods                = '/';
var debugPlay           = document.location.href.indexOf('debug') === -1 ? false : true;
var lastChatter         = '';
var curVector           = '';
var whoAmI              = '';
var confdata            = {};
var favs                = {};
var lastPollResponse    = 0;
var maxNoPollTimeout    = 30000; // no response in 30 seconds, something must be wrong
var refreshTimer        = setInterval('checkDisconnect();', maxNoPollTimeout);
var URLregex            = /(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*))/g;
var xboxRegExp          = /^xbox\s?(one|360)?$/i;
var mainvectors         = [];
var myConsoles          = '';
var firstLogin          = false;
var enterKeyAscii       = ui_strings['enterKeyAscii'] != null ? ui_strings['enterKeyAscii'] : 13;
var pmWindows           = {};
var allowSounds         = true;
var version             = 0.9971;
var chatHistory         = [];
var chatHistoryPos      = 0;
var chatHistoryMax      = 50;
var sessionkey          = '';
var ChatDisplay         = new ChatDisplay();
var gameWindow          = null;
var metrics             = null;
var metricsInterval     = null;
var doubleEnterRequired = ui_strings['doubleEnterRequired'] ==  "true" ? true : false;
var enterKeyPressCount  = 0;
var mutedPlayers        = (localStorage.getItem('kaiUI') || '').split('/');
var failedDHCPClients   = [];
var Emoticons           = [];
var Sounds              = [];
var dedupeWatcher       = [];
var engineVersion;

/**
 * Attach Engine and poll process
 */
function engineAttach() {
  var s = new AjaxObject101();

  s.funcDone = function (http) {
    engineAttach_process(http);
  };

  s.sndReq('post', '/connector/attach', '', 10000);
  debug('attaching...');
}

function engineAttach_process(r) {
  if (r.status === 200) {
    SID = r.responseText;
    debug('connected to engine...');
    sendToEngine('KAI_CLIENT_GETSTATE');
  }
}

function saveConfig(sendArray) {
  var sendSTR = '';
  for (var name in sendArray) {
    sendSTR += (sendSTR != '' ? '&' : '') + name + '=' + sendArray[name];
  }

  // send to server
  var sc = new AjaxObject101();

  sc.funcDone = function(http) {
    saveConfig_process(http);
  };

  sc.sndReq('post', '/connector/saveconfig', sendSTR, 20000);
}

function saveConfig_process(r) {
  debug('-> saveConfig_process() not implemented!');
}

function sendToEngine(cmd) {
  var ef = engineVersion >= 0x070413 ? encodeURIComponent : escape;
  var se = new AjaxObject101();

  se.funcDone = function(http) {
    sendToEngine_process(http);
  };

  se.sndReq('post', '/connector/command', 'sessionid=' + SID + '&command=' + ef(cmd), 20000);
  debug('->' + ef(cmd));
}

function sendToEngine_process(r) {
  if (r.status === 200) {
    debug('returned: ' + r.responseText);
  }
}

function poll() {
  if (SID) {
    var p = new AjaxObject101();

    p.funcDone = function (http) {
      poll_process(http);
    };

    p.sndReq('post', '/connector/poll?sessionid=' + SID, '', 25000);
  } else {
    setTimeout('poll();', 1000);
  }
}

function poll_process(r) {
  lastPollResponse = (new Date).getTime();

  if (r.status === 200) {
    var Commands = decodeURIComponent(r.responseText).split('\x01');

    for (var cmd = 0; cmd < Commands.length; cmd++) {
      debug(Commands[cmd]);

      var bits = Commands[cmd].split(';');
      var name = bits[0];

      // Check if the command has already been sent through, this only applies to 'KAI_CLIENT_PM',
      // 'KAI_CLIENT_ARENA_PM' and 'KAI_CLIENT_INVITE' commands.
      if (name === 'KAI_CLIENT_PM' || name === 'KAI_CLIENT_ARENA_PM' || name === 'KAI_CLIENT_INVITE') {
        var matched = false;

        for (var i = 0; i < dedupeWatcher.length; i++) {
          var dedupeBits = dedupeWatcher[i].split(';');
          var counter    = dedupeBits.length > bits.length ? bits.length : dedupeBits.length;
          var matches    = 0;

          // Check each bit, if all goes well something should align perfectly
          for (var j = 0; j < counter; j++) {
            if (dedupeBits[j] === bits[j]) {
              matches++;
            }
          }

          // If everything aligned then it means this command is a duplicate of the previous one
          if (matches === counter) {
            matched = true;
            break;
          }
        }

        if (matched) {
          continue;
        }

        // Does the watcher need to be cleaned up?
        if (dedupeWatcher.length === 2) {
          dedupeWatcher = dedupeWatcher.slice(1);
        }

        dedupeWatcher.push(Commands[cmd])
      }

      var command = EngineCommands[name];

      if (command !== null && typeof command === 'function') {
        command(bits);
      }
    }

    logoRotate();

    // Start the next polling run...
    poll();
  }
}

/**
 * Engine commands
 */
var EngineCommands = {
	"KAI_CLIENT_SESSION_KEY"           : function(bits) { sessionkey=encodeURIComponent(bits[1]); },
	"KAI_CLIENT_CHAT"                  : function(bits) { ChatDisplay.doChat(bits[2],bits[3]); },
	"KAI_CLIENT_CHAT2"                 : function(bits) { ChatDisplay.doChat(bits[2],bits[3]); },
	"KAI_CLIENT_LEAVES_CHAT"           : function(bits) { playerLeaveChat(bits[2]); },
	"KAI_CLIENT_JOINS_CHAT"            : function(bits) { playerJoinChat(bits[2]); },
	"KAI_CLIENT_JOINS_VECTOR"          : function(bits) { playerNew(bits[1]); },
	"KAI_CLIENT_LEAVES_VECTOR"         : function(bits) { playerRemove(bits[1]); },
	"KAI_CLIENT_SUB_VECTOR"            : function(bits) { vectorAdd(bits); },
	"KAI_CLIENT_USER_SUB_VECTOR"       : function(bits) { vectorAdd(bits); },
	"KAI_CLIENT_REMOVE_SUB_VECTOR"     : function(bits) { vectorRemove(bits[1]); },
	"KAI_CLIENT_SUB_VECTOR_UPDATE"     : function(bits) { vectorUpdate(bits); },
	"KAI_CLIENT_VECTOR"                : function(bits) { switchArenaInit(bits[1]); },
	"KAI_CLIENT_LOGGED_IN"             : function(bits) { $('initBox').style.display='none'; $('blackScreen').style.display='none'; },
	"KAI_CLIENT_NOT_LOGGED_IN"         : function(bits) { $('username').value=bits[1]; $('password').value=bits[2]; showLogin(); },
	"KAI_CLIENT_ADMIN_PRIVILEGES"      : function(bits) { adminInitialize(bits); },
	"KAI_CLIENT_MODERATOR_PRIVILEGES"  : function(bits) { modInitialize(bits); },
	"KAI_CLIENT_ARENA_PING"            : function(bits) { playerUpdatePing(bits); },
	"KAI_CLIENT_ADD_CONTACT"           : function(bits) { addFriend(bits[1]); },
	"KAI_CLIENT_ADD_FRIEND_REQ"        : function(bits) { addFriend(bits[1]); },
	"KAI_CLIENT_REMOVE_CONTACT"        : function(bits) { removeFriend(bits[1]); },
	"KAI_CLIENT_REMOVE_FRIEND"         : function(bits) { removeFriend(bits[1]); },
	"KAI_CLIENT_CONTACT_PING"          : function(bits) { contactPing(bits[1],bits[3],bits[2]); },
	"KAI_CLIENT_AVATAR"                : function(bits) { contactAvatar(bits[1],bits[2]); },
	"KAI_CLIENT_CONTACT_ONLINE"        : function(bits) { contactOnline(bits[1]); },
	"KAI_CLIENT_CONTACT_OFFLINE"       : function(bits) { contactOffline(bits[1]); },
	"KAI_CLIENT_USER_PROFILE"          : function(bits) { showProfile(bits); },
	"KAI_CLIENT_USER_DATA"             : function(bits) { setUserAndConfig(bits[1]); },
	"KAI_CLIENT_HTTP_RESPONSE"         : function(bits) { httpResponseProcess(bits); },
	"KAI_CLIENT_CONNECTED_MESSENGER"   : function(bits) { switchArena(''); toggleNavCont('cont'); },
	"KAI_CLIENT_ARENA_PM"              : function(bits) { chatPM(bits[1],whoAmI,bits[2]); },
	"KAI_CLIENT_PM"                    : function(bits) { chatPM(bits[1],whoAmI,bits[2]); },
	"KAI_CLIENT_PM_BACKLOG"            : function(bits) { chatPM(bits[1],whoAmI,bits[2],true); },
	"KAI_CLIENT_INVITE"                : function(bits) { chatDisplayInvite(bits[1],bits[2]); },
	"KAI_CLIENT_INVITE_BACKLOG"        : function(bits) { chatDisplayInvite(bits[1],bits[2]); },
	"KAI_CLIENT_METRICS"               : function(bits) { showMetrics(bits); },
	"KAI_CLIENT_LOCAL_DEVICE"          : function(bits) { addFoundConsole(bits[1]); },
	"KAI_CLIENT_REMOTE_ARENA_DEVICE"   : function(bits) { addFoundConsoleRemote(bits[1],bits[2], bits.length >= 4 ? bits[3] : false); },
	"KAI_CLIENT_STATUS"                : function(bits) { kaiClientStatus(bits); },
	"KAI_CLIENT_DETACH"                : function(bits) { kaiClientDetach(); },
	"KAI_CLIENT_RELOAD"                : function(bits) { setTimeout("window.location.reload()", 300); },
	"KAI_CLIENT_GAMECHANNEL"           : function(bits) { if(typeof gameDataProcess=='function'){ gameDataProcess(bits); } },
	"KAI_CLIENT_DBRESULT"              : function(bits) { dbResult(bits[1], bits[2], bits[3]); },
	"KAI_CLIENT_DHCP_FAILURE"          : function(bits) { setDHCPClientFailure(bits[1]); },
};

/**
 * Processes the HTTP response to work out the next step.
 *
 * @param {Array} bits Command bits from the engine
 */
function httpResponseProcess(bits) {
  var secondBit = bits.length >= 3 ? bits[2] : '';

  if (secondBit.indexOf('/connector/webuiconfig.php?action=init') !== -1) {
    setUserAndConfig_process(bits);
  }
}

/**
 * Handles console that failed connecting via DHCP and pushes them into a list for use
 * later on when detecting consoles.
 *
 * @param {string} mac A failed mac address from a DHCP ping
 */
function setDHCPClientFailure(mac) {
  if (failedDHCPClients.indexOf(mac) === -1) {
    debug('Adding failed DHCP mac address: ' + mac);
    failedDHCPClients.push(mac);
  }
}

/**
 * Parses a query sent back from the connection orbital server.
 *
 * @param {string} queryid Unique identifier
 * @param {string} status  Status message
 * @param {string} json    JSON response
 */
function dbResult(queryid, status, json) {
  if (status === 'OK' && json.length > 0) {
    var rs = eval('(' + json + ')');

    if (queryid === 'test_query') {
      // for debug - dump the resultset
      //  rs.rows <- rowcount
      //  rs.row[0] <- first row
      //  rs.row[0]['col1'] <- value of sql column col1 in row 0

      ChatDisplay.doChat('query', 'query id ' + queryid);

      for (var thisRow = 0; thisRow < rs.rows; thisRow++) {
        ChatDisplay.doChat('query', '&nbsp;&nbsp;&nbsp;row ' + thisRow);

        for (v in rs.row[thisRow]) {
          ChatDisplay.doChat('query', '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + v + ': ' + rs.row[thisRow][v]);
        }
      }
    }
  }
}

/**
 * Creates the admin nodes in the current arena.
 *
 * @param {Array} bits Command bits from the engine
 */
function adminInitialize(bits) {
  admins = '/' + bits[1].toLowerCase();
  var bytes = admins.split('/');
  var thisNode;

  for (var x = 0; x < bytes.length; x++) {
    thisNode = allPlayers[bytes[x].toLowerCase()];

    if (thisNode != null) {
      thisNode.myDiv.className = 'playerAdmin';
      thisNode.myDiv.sortKey = makeSortKey(bytes[x], 'admin');

      $('allPlayers').removeChild(thisNode.myDiv);

      InsertSorted(thisNode.myDiv, $('allPlayers'));
    }
  }
}

/**
 * Creates the moderator nodes in the current arena.
 *
 * @param {Array} bits Command bits from the engine
 */
function modInitialize(bits) {
  mods = '/' + bits[2].toLowerCase();
  var bytes = mods.split('/');
  var thisNode;

  for (var x = 0; x < bytes.length; x++) {
    thisNode = allPlayers[bytes[x].toLowerCase()];

    if (thisNode != null && admins.indexOf('/' + bytes[x] + '/') === -1) {
      thisNode.myDiv.className = 'playerMod';
      thisNode.myDiv.sortKey = makeSortKey(bytes[x], 'mod');

      $('allPlayers').removeChild(thisNode.myDiv);

      InsertSorted(thisNode.myDiv, $('allPlayers'));
    }
  }
}

/**
 * Kicks the given player from the arena.
 *
 * @param {string} player Name of the player
 */
function modKick(player) {
  sendToEngine("KAI_CLIENT_ARENA_KICK	" + player + "	");
  updateArenaCommands();
}

/**
 * Bans the given player from the arena.
 *
 * @param {string} player Name of the player
 */
function modBan(player) {
  sendToEngine("KAI_CLIENT_ARENA_BAN	" + player + "	");
  updateArenaCommands();
}

/**
 * Disconnects the given player from the server.
 *
 * @param {string} player Name of the player
 */
function modDisconnect(player) {
  sendToEngine('KAI_CLIENT_CHAT	/orb disconnect ' + player);
  updateArenaCommands();
}

/**
 * Chat locks the given player.
 *
 * @param {string} player Name of the player
 */
function modChatLock(player) {
  sendToEngine("KAI_CLIENT_CHAT_LOCK	" + player + "	");
  updateArenaCommands();
}



/*****************************************************************************************************
 Contacts
 ****************************************************************************************************/

function showProfile(bits) {
  //KAI_CLIENT_USER_PROFILE;user;age;bandwidth;location;xbox;gcn;ps2;bio;
  $('panelInfoContent').innerHTML = "User: " + bits[1] + "<br>\n";
  $('panelInfoContent').innerHTML += "Age: " + bits[2] + "<br>\n";
  $('panelInfoContent').innerHTML += "Bandwidth: " + bits[3] + "<br>\n";
  $('panelInfoContent').innerHTML += "Location: " + bits[4] + "<br>\n";
  $('panelInfoContent').innerHTML += "XBox: " + bits[5] + "<br>\n";
  $('panelInfoContent').innerHTML += "GCN: " + bits[6] + "<br>\n";
  $('panelInfoContent').innerHTML += "PS2: " + bits[7] + "<br>\n";
  $('panelInfoContent').innerHTML += "Bio: " + bits[8] + "<br>\n";

  // add any found consoles
  if (allPlayers[bits[1].toLowerCase()]) {
    $('panelInfoContent').innerHTML += "<br><br>\nFound Consoles: <br><br>\n";

    var bits = allPlayers[bits[1].toLowerCase()].consoles.split(';');

    for (var x = 0; x < bits.length; x++) {
      var ibits = bits[x].split('|');
      var console = consoleByMac(ibits[0]);

      if (console && console.length) {
        var xboxMatches = console.match(xboxRegExp);

        $('panelInfoContent').innerHTML += "<div class=\"foundConsoles\">" +
          "<img src=\"http://client.teamxlink.co.uk/media/avatars_50/Arena/" +
          (xboxMatches !== null ? ('XBox ' + RegExp.$1) : ibits.length > 1 ? ibits[1] : console).trim() +
          ".jpg\" style=\"float: left; margin-right: 5px;\">" +
          console + "</div>\n";
      }
    }
  }
}

function addContact(player)
{
	sendToEngine("KAI_CLIENT_ADD_CONTACT	"+player+"	");
  sendToEngine("KAI_CLIENT_ADD_FRIEND_REQ	"+player+"	");
	updateArenaCommands();
}

function deleteFriend(player)
{
	if (confirm( strReplace(ui_strings['contactRemove'],player) ))
		sendToEngine("KAI_CLIENT_REMOVE_CONTACT	"+player);
		sendToEngine("KAI_CLIENT_REMOVE_FRIEND	"+player);

	// remove contact from the ui listing (should not be necessary because engine sends a remove command)
	//removeFriend(bits[1]);
}

function inviteContact(player)
{
	if (confirm( strReplace(ui_strings['inviteConfirm'],player,curVector) ))
		sendToEngine("KAI_CLIENT_INVITE	"+player+"	"+curVector+"	");
		//KAI_CLIENT_INVITE;(-TU-)-Mortj109-;Arena/Gamecube/1080/1080 NTSC;;
}




function removeFriend(player)
{
	if (contacts[player.toLowerCase()])
	{
		$('contacts').removeChild($('contacts').childNodes[contacts[player.toLowerCase()].myNode]);
		delete contacts[player.toLowerCase()];

	}

}

function addFriend(player,online)
{
	if (online==null) online=0;

	if (contacts[player.toLowerCase()])
		return;
	else
		contacts[player.toLowerCase()] = { "kaitag" : player, "myNode" : 0, "online" : online };

	var tmp1= [];
	for (var name in contacts)
		if (contacts[name].online==1) tmp1[tmp1.length]=name;
	tmp1=tmp1.sort();

	var tmp2= [];
	for (var name in contacts)
		if (contacts[name].online==0) tmp2[tmp2.length]=name;
	tmp2=tmp2.sort();

	var curPlayers=[];
	for (var x=0; x<tmp1.length; x++) curPlayers[curPlayers.length]=tmp1[x];
	for (var x=0; x<tmp2.length; x++) curPlayers[curPlayers.length]=tmp2[x];

	// find the position of this new guy and reassign all node numbers at the same time
	var insertPos=0;

	for (var x=0; x < curPlayers.length; x++)
	{
		if (curPlayers[x]==player.toLowerCase()) insertPos=x;

		contacts[curPlayers[x].toLowerCase()].myNode=x;
	}

	// now add this guy at the position found
	var divNew = document.createElement('div');
	divNew.className = 'contactContainer';

	divNew.innerHTML = '<div class="contactAvatar">' +
		'  <img src="http://client.teamxlink.co.uk/media/avatars_50/blank_avatar.gif">' +
		'</div>' +
		'<div class="contactDetails">' +
		'  <div class="contactPlayer" onclick="chatPM(this.innerHTML,\'\',\'\'); ">' + player + '</div>' +
		'  <div style="text-align: left; width: 50px; float: left;">' +
		'    <a href="#" onclick="deleteFriend(\'' + player + '\');">' +
		'      <img src="/img/01-small.png" border="0" title="' + ui_strings['removeContact'] + '">' +
		'    </a>' +
		'    &nbsp;' +
		'    <a href="#" onclick="inviteContact(\'' + player + '\');">' +
		'      <img src="/img/03.png" border="0" title="' + ui_strings['invite'] + '">' +
		'    </a>' +
		'  </div>' +
		'  <div class="contactPing">' + (contacts[name].online == 1 ? pingMetric(0) : ui_strings['offline']) + '</div>' +
		'  <div class="contactArena"></div>' +
		'</div>';

	// Grey out background (default for offline players)
	divNew.style.opacity = '0.3';

	if ($('contacts').childNodes[insertPos] == null) {
		$('contacts').appendChild(divNew);
	} else {
		$('contacts').insertBefore(divNew, $('contacts').childNodes[insertPos]);
	}
}


function playerGetInfo(player) {
  // Cancel the metrics interval
  clearMetricsInterval();

  if ($('panelInfo').style.display !== 'block') {
    revealInfoPanel();
  }

  $('panelInfoContent').innerHTML = '<br><br><br><br><div style="text-align: center; font-weight: bold; font-size: 16px;">Loading...</div>';

  sendToEngine('KAI_CLIENT_GET_PROFILE	' + player + '	');
  updateArenaCommands();
}

function contactPing(player, ping, vector)
{
	if (contacts[player.toLowerCase()])
	{
		var followme = '<a href="#" onclick="switchArena(\'' + vector + '\'); return false;" title="' + vector + '">' + vector.substring(vector.lastIndexOf('/') + 1) + '</a>';

		var contactIndex = contacts[player.toLowerCase()].myNode;
		var contactNode  = $('contacts').childNodes[contactIndex];

		if (contactNode != null) {
			contactNode.querySelector('.contactArena').innerHTML = followme;
			contactNode.querySelector('.contactPing').innerHTML = pingMetric(ping);
		}
	}
}

function playerIsMuted(player) {
	for (var i in mutedPlayers) {
		if (mutedPlayers.hasOwnProperty(i) && mutedPlayers[i] === player) {
			return true;
		}
	}

	return false;
}

function mutePlayer(player) {
	if (!confirm(strReplace(ui_strings['confirmMutePlayer'], player))) {
		return;
	}

	mutedPlayers.push(player);
	localStorage.setItem('kaiUI', mutedPlayers.join('/'));

	// Notify in the chat
	ChatDisplay.doChat('XLink Kai Bot', strReplace(ui_strings['playerMuted'], player));

	// Close the commands panel
	updateArenaCommands();
}

function unmutePlayer(player) {
	if (!confirm(strReplace(ui_strings['confirmUnmutePlayer'], player))) {
		return;
	}

	var updatedMuteList = [];

	for (var i in mutedPlayers) {
		if (mutedPlayers.hasOwnProperty(i) && mutedPlayers[i] !== player) {
			updatedMuteList.push(mutedPlayers[i]);
		}
	}

	mutedPlayers = updatedMuteList;
	localStorage.setItem('kaiUI', updatedMuteList.join('/'));

	// Notify in the chat
	ChatDisplay.doChat('XLink Kai Bot', strReplace(ui_strings['playerUnmuted'], player));

	// Close the commands panel
	updateArenaCommands();
}

function contactOffline(player)
{
	var url = '<img src="http://client.teamxlink.co.uk/media/avatars_50/blank_avatar.gif">';

	if (contacts[player.toLowerCase()]) {
		removeFriend(player);
		addFriend(player, 0);

		var contactIndex = contacts[player.toLowerCase()].myNode;
		var contactNode  = $('contacts').childNodes[contactIndex];

		contactNode.querySelector('.contactAvatar').innerHTML = url;
		contactNode.querySelector('.contactPing').innerHTML = ui_strings['offline'];
		contactNode.querySelector('.contactArena').innerHTML = '';

		// Grey out offline contacts
		contactNode.style.opacity = '0.3';
	}
}

function contactOnline(player)
{
	if (contacts[player.toLowerCase()]) {
		removeFriend(player);
		addFriend(player, 1);

		var contactIndex = contacts[player.toLowerCase()].myNode;

		// Brighten online contacts
		$('contacts').childNodes[contactIndex].style.opacity = '0.8';
	}

	 // Request avatar if contact is seen online
	sendToEngine("KAI_CLIENT_AVATAR\t" + player);
}


function contactAvatar(player, url)
{
	if (contacts[player.toLowerCase()]) {
		var contactIndex = contacts[player.toLowerCase()].myNode;
		$('contacts').childNodes[contactIndex].querySelector('.contactAvatar').innerHTML = '<img src="' + url + '">';
	}
}











/*****************************************************************************************************
 Players Functions
 ****************************************************************************************************/


function playerNew(player)
{
	var lower=player.toLowerCase();

	if (allPlayers[lower]) return;

	allPlayers[lower] =
	{
		'kaitag'		: player,
		'consoles'		: '',
		'inChat'		: false,
		'rank'			: 'user',
		'avatar'		: '',
		'sortKey'		: '',
		'country'		: '',
		'epoch'			: '',
		'arenaStatus'	: '',
		'awayMessage'	: '',
		'myDiv'			: '',
		'isSelected'	: false
	};


	var divNew=document.createElement('div');

	divNew.onclick=function(){ updateArenaCommands(player); }
	divNew.onmouseover=function(){ this.className=this.className+'Over'; }
	divNew.onmouseout=function(){ this.className=this.className.substring(0,this.className.indexOf('Over')); }

	var divPlayer=document.createElement('div');

	divPlayer.className='playerName';
	divPlayer.innerHTML = player;
	//divPlayer.onclick=function(){ playerGetInfo(player); }
	divNew.divPlayer=divPlayer;
	divNew.appendChild(divPlayer);

	var divInChat=document.createElement('div');
	divInChat.className='playerInChat';
	divInChat.innerHTML="<img src=\"/img/28.png\" title=\""+ui_strings['inChat']+"\" style=\"margin-top: 3px; margin-right: 3px;\">";
	divNew.divInChat=divInChat;
	divNew.appendChild(divInChat);

	var divPing=document.createElement('div');
	divPing.className='playerPing';
	if (player!=whoAmI && curVector!='') divPing.innerHTML=pingMetric(0);
	divNew.divPing=divPing;
	divNew.appendChild(divPing);

	var divStatus=document.createElement('div');
	divStatus.className='playerStatus';
	if (player!=whoAmI && curVector!='') divStatus.innerHTML='idle';
	divNew.divStatus=divStatus;
	divNew.appendChild(divStatus);

//	var divActions=document.createElement('div');
//	divActions.className='playerActions';
//	if (mods.indexOf('/'+whoAmI.toLowerCase()+'/') !== -1 || admins.indexOf('/'+whoAmI.toLowerCase()+'/') !== -1)
//	{
//		divActions.innerHTML="<a href=\"#\" onclick=\"modKick('"+player+"'); return false;\"><img src=\"/img/01.png\" border=\"0\" title=\""+
//			ui_strings['kick']+"\"></a>&nbsp;&nbsp;"+
//			"<a href=\"#\" onclick=\"modBan('"+player+"'); return false;\"><img src=\"/img/50.png\" border=\"0\" title=\""+
//			ui_strings['ban']+"\"></a>";
//	}
//	divNew.divActions=divActions
//	divNew.appendChild(divActions);


	if (admins.indexOf('/'+lower+'/') !== -1)
	{
		divNew.className='playerAdmin';
		divNew.sortKey=makeSortKey(player, 'admin');
	}
	else if (mods.indexOf('/'+lower+'/') !== -1)
	{
		divNew.className='playerMod';
		divNew.sortKey=makeSortKey(player, 'mod');
	}
	else
	{
		divNew.sortKey=makeSortKey(player,'user');
		divNew.className='playerUser';
	}

	InsertSorted(divNew, $('allPlayers') );
	allPlayers[lower].myDiv=divNew;

	// display current player count
	$('headerPlayers').innerHTML=ui_strings['headerPlayers']+" - "+objPropCount(allPlayers);
}

function playerRemove(player)
{
	//var thisPlayer = allPlayers[player.toLowerCase()];

	if(allPlayers[player.toLowerCase()]!=null)
	{
		// remove dood from view
		$('allPlayers').removeChild(allPlayers[player.toLowerCase()].myDiv);

		// remove dood from player object
		delete allPlayers[player.toLowerCase()];
		//allPlayers[player.toLowerCase()]=null;

		// display current player count
		$('headerPlayers').innerHTML=ui_strings['headerPlayers']+" - "+objPropCount(allPlayers);
	}
}


function playerJoinChat(player)
{
	playerNew(player);
	allPlayers[player.toLowerCase()].inChat=true;
	allPlayers[player.toLowerCase()].myDiv.divInChat.style.display='block';
}

function playerLeaveChat(player)
{
	if (allPlayers[player.toLowerCase()])
	{
		allPlayers[player.toLowerCase()].myDiv.divInChat.style.display='none';
		if (curVector=='') playerRemove(player);
	}
}


function playerUpdatePing(bits)
{
	var player = bits[1];
	var ping = bits[2];
	var status = bits[3]==1 ? 'busy' : bits[3]==2 ? 'hosting' : 'idle';
	if (allPlayers[player.toLowerCase()])
	{
		allPlayers[player.toLowerCase()].myDiv.divPing.innerHTML=pingMetric(ping);
		allPlayers[player.toLowerCase()].myDiv.divStatus.innerHTML=status;
	}



	if ($('arenaCommands').player==player)
		$('arenaCommands').childNodes[2].innerHTML='Ping: '+ping+' ms';
}




/*****************************************************************************************************
 Vectors
 ****************************************************************************************************/


function switchArena(vector)
{
	// hello engine, take to this vector
	if (vector=='')
	{
		sendToEngine('KAI_CLIENT_VECTOR		');
		//sendToEngine('KAI_CLIENT_CHATMODE	General Chat	');
		toggleNavCont('cont');
		return;
	}
	else
	{
		sendToEngine('KAI_CLIENT_VECTOR	'+vector+'	');
		toggleNavCont('nav');
	}

	//switchArenaInit(vector);
}

function switchArenaPrivate(vector,pass)
{
		sendToEngine('KAI_CLIENT_VECTOR	'+vector+'	'+pass+'	');
		toggleNavCont('cont');
	//switchArenaInit(vector);
}




function switchArenaInit(vector)
{
	var isPrivate=0;
	if (vectors[vector.toLowerCase()])
		var isPrivate = vectors[vector.toLowerCase()].isprivate;


	//var vectorPrev = vectors
	//KAI_CLIENT_SUB_VECTOR;		vector;users;subs;ispass;maxplayers;

	// reinitialize vector and chat player objects
	allPlayers={};
	vectors={};
	chatHistory=[];
	lastChatter='';

	clearDivs('allPlayers');
	clearDivs('chat');
	clearDivs('kaiVectors');
	$('headerPlayers').innerHTML=ui_strings['headerPlayers']+" - 0";


	// add previous vector
	var vectorPrev=vector.substring(0,vector.lastIndexOf('/'));
	if (vectorPrev!='')	vectorAdd([ 'Previous Vector',vectorPrev, 0,0,0,0 ]);

	// update icon
	if (isPrivate==1 || vector.substring(vector.lastIndexOf("/")+1)=='' || vector.substring(vector.lastIndexOf("/")+1)==whoAmI)
		$('arenaIcon').src='http://client.teamxlink.co.uk/media/avatars_50/default.jpg';
	else
		$('arenaIcon').src='http://client.teamxlink.co.uk/media/avatars_50/'+vector+".jpg"


	// if icon no workie, make default
	setTimeout("checkAvatar('arenaIcon');",2000);

	// update navigation
	var tmp = '';
	var bits = vector.split("/");
	var backArena= '';
	var start=(bits.length > 1 ? bits.length-2 : 0);

	for (var x=0; x < bits.length; x++)
	{
		backArena+=(x>0 ? "/" : '')+bits[x];
		tmp+=(x>0 ? "&nbsp;>&nbsp;" : '')+"<a href=\"#\" onclick=\"switchArena('"+backArena+"'); return false;\">"+bits[x]+"</a>";
	}

	tmp+="<div style=\"text-align: right;\">";
	if (isPrivate==0 && vector.substring(vector.lastIndexOf("/")+1)!=whoAmI)
	{

		if (favs[vector.toLowerCase()])
			doNothing();
		else
		{
			tmp+="<a href=\"#\" onclick=\"favNew('"+vector+"'); return false;\"><img src=\"/img/32.png\" border=\"0\" title=\""+
				ui_strings['addFav']+"\"></a>&nbsp;";
		}

		tmp+="<a href=\"#\" onclick=\"displayCreateArena(); return false;\"><img src=\"/img/19.png\" border=\"0\" title=\""+ui_strings['createPrivate']+"\"></a>&nbsp;";
	}
	tmp+="</div>";

	// specify where the fuck we are
	if (vector=='')
	{
		$('arenaCurrent').innerHTML="General Chat";
		//$('vectors').style.display='none';
	}
	else
	{
		$('arenaCurrent').innerHTML=tmp;
		//$('vectors').style.display='block';
	}

	// change chat arena to this vector
	setTimeout("sendToEngine('KAI_CLIENT_CHATMODE	"+(vector!='' ? vector : "General Chat")+"	');",200);

	// get subvectors
	setTimeout("sendToEngine('KAI_CLIENT_GET_VECTORS	"+vector+"	');",200);

	curVector=vector;

	updateArenaCommands();
}



function vectorAdd(bits)
{
	//KAI_CLIENT_SUB_VECTOR;		vector;users;subs;ispass;maxplayers;
	//KAI_CLIENT_USER_SUB_VECTOR;	vector;users;subs;ispass;maxplayers;description;
	if (vectors[bits[1].toLowerCase()])
		return;
	else
	{
		vectors[bits[1].toLowerCase()] =
		{
			 "vector"		: bits[1],
			 "users"		: bits[2],
			 "subs"			: bits[3],
			 "ispass"		: bits[4],
			 "maxplayers"	: bits[5],
			 "myNode" 		: 0,
			 "isprivate"	: (bits[0]=="KAI_CLIENT_USER_SUB_VECTOR" ? 1 : 0),
			 "description"	: bits[6]
		};
	}

	var insertPos=objReassign_myNode(vectors,bits[1]);

	var divNew=document.createElement('div');
	divNew.className='kaiVectorContainer';

	var arena='';
	if (vectors[bits[1].toLowerCase()].ispass!=0) arena="<img src=\"/img/13.png\">&nbsp;";
	arena+=bits[1].substring(bits[1].lastIndexOf("/")+1);

	if (vectors[bits[1].toLowerCase()].ispass==0)
		divNew.onclick=function(){ switchArena(bits[1]);  }
	else
		divNew.onclick=function(){ displayEnterPassword(bits[1]);  }

	// Is this a return to previous arena or a current sub arena?
	if (bits[0]=='Previous Vector')
	{
		divNew.className = 'kaiVectorContainerPrevious';
		divNew.style.backgroundImage="url('/img/return.png')";
		divNew.innerHTML="<div style=\"margin-left: 60px;\">"+ui_strings['returnTo']+" "+
			bits[1].substring(bits[1].lastIndexOf("/")+1);+"</div>"+
			"<div style=\"margin-left: 60px;\">"+ui_strings['returnTo']+"</div>";
	}
	else
	{
		// Does the arena need to be styled differently?
		var featuredVector      = false;
		var vectorTextOffset    = '60px';
		var slashesInCurVector  = curVector.match(/\//g);
		var slashesInThisVector = bits[1].match(/\//g);

		slashesInCurVector  = slashesInCurVector  ? slashesInCurVector.length + 1  : 1;
		slashesInThisVector = slashesInThisVector ? slashesInThisVector.length - 1 : 0;

		if ((slashesInCurVector === 1 && slashesInThisVector >= 1) || slashesInThisVector === slashesInCurVector) {
			featuredVector    = true;
			vectorTextOffset  = '36px';
			divNew.className  = 'kaiVectorContainerFeatured';
		}

		// add arena image
		var arenaImg="http://client.teamxlink.co.uk/media/avatars_50/"+bits[1]+".jpg";
		if (bits[0]=="KAI_CLIENT_USER_SUB_VECTOR")
			arenaImg="http://client.teamxlink.co.uk/media/avatars_50/"+bits[1].substring(0,bits[1].lastIndexOf('/'))+".jpg";
		divNew.style.backgroundImage="url('"+arenaImg+"')";

		// add arena text
		divNew.innerHTML="<div style=\"margin-left: " + vectorTextOffset + ";\">"+arena+"</div>"+
			"<div style=\"margin-left: " + vectorTextOffset + ";\">"+bits[2]+
			(vectors[bits[1].toLowerCase()].isprivate==1 ? (bits[5] > 0 ? "/"+bits[5]+' ' : ' ') : ' ')+
			ui_strings['players']+"</div>";

		if (!featuredVector) {
			if (vectors[bits[1].toLowerCase()].isprivate==0)
				divNew.innerHTML+="<div style=\"margin-left: 60px;\">"+bits[3]+" "+ui_strings['privateArenas']+"</div>";
			else
				divNew.innerHTML+="<div style=\"margin-left: 60px;\">"+unescape(bits[6])+"</div>";
		}
	}

	if ($('kaiVectors').childNodes[insertPos]==null)
		$('kaiVectors').appendChild(divNew);
	else
		$('kaiVectors').insertBefore(divNew, $('kaiVectors').childNodes[insertPos]);
}



function vectorRemove(vector)
{

	if (vectors[vector.toLowerCase()])
	{
		$('kaiVectors').removeChild($('kaiVectors').childNodes[vectors[vector.toLowerCase()].myNode]);
		delete vectors[vector.toLowerCase()];
		objReassign_myNode(vectors,vector);
	}

}



function vectorUpdate(bits)
{
	//KAI_CLIENT_SUB_VECTOR_UPDATE;vector;count;subs;
	if (vectors[bits[1].toLowerCase()])
	{
		var thisVector = vectors[bits[1].toLowerCase()];
		//$('kaiVectors').childNodes[vectors[bits[1].toLowerCase()].myNode].childNodes[1].innerHTML=bits[2]+" players";
		$('kaiVectors').childNodes[thisVector.myNode].childNodes[1].innerHTML="<div>"+
			bits[2]+ (thisVector.isprivate==1 ? (thisVector.maxplayers > 0 ? "/"+thisVector.maxplayers+' ' : ' ') : ' ')+
			ui_strings['players']+"</div>";


		// only update the private arena count for non private arenas (regular vectors)
		if (vectors[bits[1].toLowerCase()].isprivate == 0) {
			var vectorNode = $('kaiVectors').childNodes[thisVector.myNode];

			if (vectorNode.className !== 'kaiVectorContainerFeatured') {
				vectorNode.childNodes[2].innerHTML = bits[3] + ' ' + ui_strings['privateArenas'];
			}
		}
	}
}


/*****************************************************************************************************
 Chat
 ****************************************************************************************************/

function chatKeyUp(event)
{
	if (isKey(event,enterKeyAscii))
	{
		// handle double enter for japanese
		if (doubleEnterRequired===true && ++enterKeyPressCount < 2)	return;
		enterKeyPressCount=0;

		chatHistory.unshift($('msg').value);
		if (chatHistory.length > chatHistoryMax) chatHistory.pop();
		chatHistoryPos=0;

		sendChat($('msg').value);
		$('msg').value='';
		$('msg').focus();
	}

	// key up
	if (isKey(event,38))
	{
		if (chatHistory[chatHistoryPos] !== undefined)
			$('msg').value=chatHistory[chatHistoryPos];
		chatHistoryPos=(++chatHistoryPos < chatHistoryMax && chatHistoryPos < chatHistory.length) ? chatHistoryPos : --chatHistoryPos;
	}

	// key down
	if (isKey(event,40))
	{
		if (--chatHistoryPos >=0)
			$('msg').value=chatHistory[chatHistoryPos];
		else
		{
			$('msg').value='';
			chatHistoryPos=0;
		}
	}

}


function ChatDisplay()
{
	this.kaitag=null;
	this.txt=null;
	this.max=500;
	this.lastChatter=null;
	this.newDiv=null;
	this.proceed=true;

	this.doChat=function(kaitag,txt)
	{
		if (playerIsMuted(kaitag)) {
			return;
		}

		this.kaitag=kaitag;
		this.txt=txt;
		this.proceed=true;

		if (this.proceed) this.textCleanUp();
		if (this.proceed) this.textHighlightName();
		if (this.proceed) this.textReplaceLinks();
		if (this.proceed) this.textReplaceEmoticons();
		if (this.proceed) this.doTriggers();
		if (this.proceed) this.setKaiTag();
		if (this.proceed) this.divCreate();
		if (this.proceed) this.divInsert();
		if (this.proceed) this.scrollBottom();
	}


	this.textCleanUp=function()
	{
		this.txt=unescape(this.txt);
		this.txt=this.txt.replace(/</g,"&lt;");
		this.txt=this.txt.replace(/\x02/g,";");
		this.txt=this.txt.replace(/\n/g,"<br>");
	}

	this.textReplaceEmoticons=function()
	{
		for(i=0;i<Emoticons.length;i++)
		{
			this.txt=this.txt.replace(Emoticons[i][0],"<img class=\"emote\" src='"+Emoticons[i][1]+"' />");
		}
	}

	this.textHighlightName=function()
	{
		if (this.txt.indexOf(whoAmI) != -1)
		{
			this.txt=this.txt.replace(whoAmI,"<span class=\"highlight\">"+whoAmI+"</span>");
		}
	}

	this.textReplaceLinks=function()
	{
		this.txt=this.txt.replace(URLregex," <a href=\"$1\" target=\"_blank\">$1</a> ");
	}

	this.setKaiTag=function()
	{
		if (this.lastChatter==this.kaitag)
		{
			this.kaitag="&nbsp;";
		}
		else
		{
			this.lastChatter=this.kaitag;
		}
	}

	this.doTriggers=function()
	{
		for (var trigger in ChatTriggers)
		{
			if (this.txt.indexOf(trigger) !== -1)
			{
				if(ChatTriggers[trigger]!=null)
				{
					ChatTriggers[trigger](this);
				}
			}
		}
	}

	this.divCreate=function()
	{
		this.divNew=document.createElement('div');

		if (mods.indexOf('/'+this.kaitag.toLowerCase()+'/') !== -1 || mods.indexOf('/'+this.lastChatter.toLowerCase()+'/') !== -1)
			this.divNew.className='chatMod';
		if (admins.indexOf('/'+this.kaitag.toLowerCase()+'/') !== -1 || admins.indexOf('/'+this.lastChatter.toLowerCase()+'/') !== -1 || this.kaitag === 'XLink Kai Bot')
			this.divNew.className='chatAdmin';

		if (this.kaitag != "Kai Orbital Mesh" && this.lastChatter != 'Kai Orbital Mesh')
		{
			this.divNew.innerHTML="<table><tr><td class='chatUsername' onclick=\"$('msg').value+=' "+
				this.kaitag+"'; $('msg').focus();\">" + this.kaitag + "</td>"+
				"<td class='chatText'>"+this.txt+"</td></tr></table>";
		}
		else
		{
			this.divNew.innerHTML="<table><tr><td class='chatText'>"+this.txt+"</td></tr></table>";
		}
	}

	this.divInsert=function()
	{
		if ($('chat').childNodes.length > this.max)
		{
			$('chat').removeChild($('chat').childNodes[0]);
		}

		$('chat').appendChild(this.divNew);
	}

	this.scrollBottom=function()
	{
		$('chat').scrollTop = $('chat').scrollHeight;
	}

	this.moveArena=function()
	{
		if (mods.indexOf('/'+this.kaitag.toLowerCase()+'/') !== -1 || admins.indexOf('/'+this.kaitag.toLowerCase()+'/') !== -1)
		{
			switchArena(this.txt.substring(this.txt.indexOf(' ')+1));
			this.proceed=false;
		}
	}

	this.doAnoyz=function()
	{
		if (this.kaitag=='prestige')
		{
			soundPlay('lolz');
			this.proceed=false;
		}
	}
}

function chatPM(sender, recipient, txt, silent) {
  var useSender = sender == whoAmI ? recipient : sender;

  if (playerIsMuted(sender)) {
    return;
  }

  silent = silent || false;

  if (pmWindows[sender] == null && sender != whoAmI) {
    // beep
    if (allowSounds && silent !== true) soundPlay('pm');

    var newDiv = document.createElement('div');
    newDiv.className = 'pmContainer';
    newDiv.style.top = (50 + (objPropCount(pmWindows) * 25)) + 'px';
    newDiv.style.left = (240 + (objPropCount(pmWindows) * 25)) + 'px';
    newDiv.id = 'pm_' + sender;

    var tmp = document.createElement('div');
    tmp.className = 'pmChatTitle';
    tmp.innerHTML = '&nbsp;' + sender;
    tmp.onmousedown = function (event) { dragStart(event, 'pm_' + sender); }
    newDiv.appendChild(tmp);

    var tmp = document.createElement('div');
    tmp.className = 'pmClose';
    tmp.innerHTML = '&nbsp;';
    tmp.onclick = function () { $('pm_' + sender).style.display = 'none'; }
    newDiv.appendChild(tmp);

    var tmp = document.createElement('div');
    tmp.className = 'pmChatBox';
    newDiv.appendChild(tmp);

    var tmp = document.createElement('input');
    tmp.className = 'pmInputBox';
    tmp.enterKeyPressCount = 0;

    tmp.onkeyup = function (event) {
      if (isKey(event, enterKeyAscii)) {
        // handle double enter for japanese
        if (doubleEnterRequired === true && ++this.enterKeyPressCount < 2) return;
        this.enterKeyPressCount = 0;

        chatPM(whoAmI, sender, this.value);
        sendChat('/msg ' + sender + ' ' + this.value);
        this.value = '';
        this.focus();
      }
    };

    newDiv.appendChild(tmp);

    document.getElementsByTagName('BODY')[0].appendChild(newDiv);
    pmWindows[sender] = newDiv;
  }

  // open window if it exists and is closed
  if (pmWindows[sender] != null) {
    if ($('pm_' + sender).style.display == 'none') {
      if (allowSounds) soundPlay('pm');
      $('pm_' + sender).style.display = 'block';
    }
  }

  var max = 500;

  if (pmWindows[useSender].childNodes[2].childNodes.length > max) {
    pmWindows[useSender].childNodes[2].removeChild(pmWindows[useSender].childNodes[2].childNodes[0]);
  }

  if (txt) {
    txt = unescape(txt);
    txt = txt.replace(/</g, "&lt;");
    txt = txt.replace(/\x02/g, ";");
    txt = txt.replace(/\n/g, "<br>");

    txt = doEmoticons(txt);
    txt = txt.replace(URLregex, " <a href=\"$1\" target=\"_blank\">$1</a> ");

    var divNew = document.createElement('div');
    divNew.innerHTML = '<div class=\"chatText\">' + sender + ': ' + txt + "</div>";

    pmWindows[useSender].childNodes[2].appendChild(divNew);
  }

  pmWindows[useSender].childNodes[2].scrollTop = pmWindows[useSender].childNodes[2].scrollHeight;
}





function chatDisplayInvite(kaitag,arena)
{
	var max=50;

	if ($('chat').childNodes.length > max)
		$('chat').removeChild($('chat').childNodes[0]);

	if (arena)
	{

		var divNew=document.createElement('div');
		divNew.innerHTML="<div class=\"chatUsername\" style=\"background-color: #f4f4f4;\">"+kaitag+"</div>"+
			"<div class=\"chatText\" style=\"background-color: #f4f4f4;\">"+
			"invites you to join <a href=\"#\" onclick=\"switchArena('"+arena+"'); return false;\">"+arena+"</a>"+
			"</div>";

		$('chat').appendChild(divNew);
		lastChatter=kaitag;
	}
	$('chat').scrollTop = $('chat').scrollHeight;
}

function sendChat(txt)
{
	if (txt=='') return;

	if (txt.indexOf('/msg ') === 0)
	{
		var player=txt.substring(txt.indexOf(' ')+1);
		player=player.substring(0,player.indexOf(' '));
		txt=txt.substring(txt.indexOf(' ')+1);
		txt=txt.substring(txt.indexOf(' ')+1);

		var sendText=(engineVersion >= 0x070413) ? txt : encodeURIComponent(txt);

		if (contacts[player.toLowerCase()])
		{
			if (contacts[player.toLowerCase()].online==true)
				sendToEngine('KAI_CLIENT_PM	'+player+'	'+(txt.substring(0,1)=="/" ? txt : sendText)+'	');
			else
				sendToEngine('KAI_CLIENT_ARENA_PM	'+player+'	'+(txt.substring(0,1)=="/" ? txt : sendText)+'	');
		}
		else
			sendToEngine('KAI_CLIENT_ARENA_PM	'+player+'	'+(txt.substring(0,1)=="/" ? txt : sendText)+'	');

		return;
	}

	if (txt.indexOf('/me ') === 0)
	{
		var tmp=txt;
		txt=whoAmI+' '+txt.substring(4);
	}

	if (txt.indexOf('/showdebug') === 0)
	{
		debugPlay=true;
		$('debugContainer').style.display=$('debugContainer').style.display=='block' ? 'none' : 'block';
		return;
  }

	if (txt.indexOf('/testdb') === 0)
	{
		sendToEngine("KAI_CLIENT_DB\tcre\tcreate table kai_test (field1 text primary key, field2 text, field3 text)\t");
		sendToEngine("KAI_CLIENT_DB\tins\tinsert into kai_test values (?,?,?)\tabc\tdef\tghi\t");
		sendToEngine("KAI_CLIENT_DB\tint\tinsert into kai_test values (?,?,?)\tjkl\tmno\tpqr\t");
		sendToEngine("KAI_CLIENT_DB\ttest_query\tselect * from kai_test\t");
		sendToEngine("KAI_CLIENT_DB\tdrop\tdrop table kai_test\t");
		return;
	}

	if (txt.indexOf('/chatkey ') === 0)
	{
		enterKeyAscii=txt.substring(9);
		return;
	}

	if (txt.indexOf('/cmd ') === 0)
	{
		sendToEngine("KAI_CLIENT_GET_URL	client.teamxlink.co.uk	/connector/webuiconfig.php?action=cmd&username="+
			whoAmI+
			"&sk="+sessionkey+
			"&detail="+escape(txt.substring(4))+"	");
		return;
	}

	txt=txt.replace(/;/g,"\x02");
	//txt=txt.replace(/\+/g,"%2B");
	txt=txt.replace(/\%/g,"%25");

	if(engineVersion >= 0x070413)
		sendToEngine('KAI_CLIENT_CHAT	'+txt+'	');
	else
		sendToEngine('KAI_CLIENT_CHAT	'+(txt.substring(0,1)=="/" ? txt : encodeURIComponent(txt))+'	');
}



function doEmoticons(msg)
{
	for(i=0;i<Emoticons.length;i++)
	{
		msg=msg.replace(Emoticons[i][0],"<img class=\"emote\" src='"+Emoticons[i][1]+"' />");
	}
	return msg;
}


/*****************************************************************************************************
 Favourites
 ****************************************************************************************************/

function favAdd(vector)
{
	if (favs[vector.toLowerCase()])
		return;
	else
		favs[vector.toLowerCase()] = { "vector" : vector, "myNode" : 0 };

	var insertPos=objReassign_myNode(favs,vector);


	var arenaImg="http://client.teamxlink.co.uk/media/avatars_50/"+vector+".jpg";

	var divNew=document.createElement('div');
	divNew.className='kaiFavContainer';
	divNew.style.backgroundImage="url('"+arenaImg+"')";

	divNew.innerHTML = "<div style=\"margin-left: 60px;\">"+
		vector.substring(vector.lastIndexOf('/')+1)+
		"</div>"+
		"<div style=\"text-align: right;\">"+
		"<a href=\"#\" onclick=\"favRemove('"+vector+"');\" return false;><img src=\"/img/30.png\" border=\"0\" title=\""+ui_strings['removeFav']+"\"></a>&nbsp;&nbsp;"+
		"<a href=\"#\" onclick=\"switchArena('"+vector+"');\" return false;><img src=\"/img/05.png\" border=\"0\" title=\""+ui_strings['go']+"\"></a>&nbsp;&nbsp;"+
		"</div>";

	if ($('kaiFavs').childNodes[insertPos]==null)
		$('kaiFavs').appendChild(divNew);
	else
		$('kaiFavs').insertBefore(divNew, $('kaiFavs').childNodes[insertPos]);
}



function favRemove(vector)
{

	if (favs[vector.toLowerCase()])
	{
		if (confirm("Press OK to remove "+vector.substring(vector.lastIndexOf('/')+1)+" from favourites."))
		{
			$('kaiFavs').removeChild($('kaiFavs').childNodes[favs[vector.toLowerCase()].myNode]);
			delete favs[vector.toLowerCase()];
			objReassign_myNode(favs,vector);

			sendToEngine("KAI_CLIENT_GET_URL	client.teamxlink.co.uk	/connector/webuiconfig.php?action=removefav&username="+
						whoAmI+
						"&sk="+sessionkey+
						"&vector="+escape(vector)+"	");
		}
	}

}

function favNew(vector)
{
	if (confirm( strReplace(ui_strings['confirmAddVector'],vector) )!==true) return;
	favAdd(vector);
	toggleNavCont('fav');
	sendToEngine("KAI_CLIENT_GET_URL	client.teamxlink.co.uk	/connector/webuiconfig.php?action=addfav&username="+
			whoAmI+
			"&sk="+sessionkey+
			"&vector="+escape(vector)+"	");
}





/*****************************************************************************************************
 Miscellaneous
 ****************************************************************************************************/

function logoRotate() {
  var curX = $('logo').style.backgroundPosition.replace(/px.*$/, '');

  if (curX <= -196 || curX == '') {
    curX = 0;
  } else {
    curX = (curX * 1) - 28;
  }

  $('logo').style.backgroundPosition = curX + 'px';
}



function updateArenaCommands()
{
	var curH=pageHeight() > 400 ? pageHeight() : 400;

	if (arguments[0])
		var player=arguments[0];
	else
		var player='';

	if ($('arenaCommands').player==player) player='';

	if (player=='')
	{
		$('arenaCommands').innerHTML=ui_strings['arenaCommands'];
		$('arenaCommands').style.height='50px';
		$('allPlayers').style.height=curH-115+'px';
		$('arenaCommands').player='';
		return;
	}

	player=arguments[0];

	$('arenaCommands').player=player;

	$('arenaCommands').innerHTML= "<div class=\"infoPlayerIMG\"></div>"+
		"<div class=\"infoPlayerName\" onclick=\"updateArenaCommands();\">"+player+"</div>"+
		"<div class=\"infoPlayerPing\">"+(curVector != '' && player!=whoAmI ? "Ping: " : " ")+"</div>";

	var cmds='';
	if (player!=whoAmI)
	{
		cmds+="<a href=\"#\" onclick=\"chatPM('"+player+"',''); return false;\">"+ui_strings['sendArenaPM']+"</a><br>\n";
		cmds+="<a href=\"#\" onclick=\"addContact('"+player+"'); return false;\">"+ui_strings['addFriend']+"</a><br>\n";
	}
	cmds+="<a href=\"#\" onclick=\"playerGetInfo('"+player+"'); return false;\">"+ui_strings['viewProfile']+"</a><br>\n";

	if (playerIsMuted(player)) {
		cmds+="<a href=\"#\" onclick=\"unmutePlayer('"+player+"'); return false;\">"+ui_strings['unmutePlayer']+"</a><br>\n";
	} else {
		cmds+="<a href=\"#\" onclick=\"mutePlayer('"+player+"'); return false;\">"+ui_strings['mutePlayer']+"</a><br>\n";
	}



	if (contacts[player])
	{
		cmds+="<a href=\"#\" onclick=\"chatPM('"+player+"'); return false;\">"+ui_strings['privateChat']+"</a><br>\n";
	}

	if (mods.indexOf('/'+whoAmI.toLowerCase()+'/') !== -1 || admins.indexOf('/'+whoAmI.toLowerCase()+'/') !== -1 && curVector != '')
	{
		cmds+=	"<a href=\"#\" onclick=\"modKick('"+player+"'); return false;\">"+ui_strings['kick']+"</a><br>\n"+
				"<a href=\"#\" onclick=\"modBan('"+player+"'); return false;\">"+ui_strings['ban']+"</a><br>\n";
	}

	if (mods.indexOf('/'+whoAmI.toLowerCase()+'/') !== -1 || admins.indexOf('/'+whoAmI.toLowerCase()+'/') !== -1)
	{
		cmds+=	"<a href=\"#\" onclick=\"modDisconnect('"+player+"'); return false;\">"+ui_strings['disconnect']+"</a><br>\n"+
				"<a href=\"#\" onclick=\"modChatLock('"+player+"'); return false;\">"+ui_strings['chatLock']+"</a><br>\n";
	}

	$('arenaCommands').innerHTML+="<div class=\"infoPlayerCommands\">"+cmds+"</div>";

	$('arenaCommands').style.height='210px';
	$('allPlayers').style.height=(curH-275)+'px';

	//setTimeout("updateArenaCommands();",10000);


//	var cont="<br>";
//
//	cont+= "<a href=\"#\" onclick=\"playerGetInfo(); return false;\"><img src=\"/img/49.png\" border=\"0\" title=\""+ui_strings['info']+"\"></a>&nbsp;&nbsp;";
//
//	if (mods.indexOf('/'+whoAmI.toLowerCase()+'/') !== -1 || admins.indexOf('/'+whoAmI.toLowerCase()+'/') !== -1 && curVector != '')
//	{
//		cont+= "<a href=\"#\" onclick=\"modKick(); return false;\"><img src=\"/img/01.png\" border=\"0\" title=\""+
//			ui_strings['kick']+"\"></a>&nbsp;&nbsp;";
//		cont+= "<a href=\"#\" onclick=\"modBan(); return false;\"><img src=\"/img/50.png\" border=\"0\" title=\""+
//			ui_strings['ban']+"\"></a>";
//	}
//
//	$('arenaCommands').innerHTML = cont;
}


function makeSortKey(tag, rank)
{
	switch(rank)
	{
		case 'admin':
			sortKey='0_';
			break;
		case 'mod':
			sortKey='5_';
			break;
		default:
			sortKey='9_';
			break;
	}
	lower = tag.toLowerCase();

	for(i=0;i<lower.length;i++)
	{
		ch = lower.substr(i,1);
		if((ch>='a' && ch<='z') || (ch>='0' && ch<='9'))
			sortKey += ch;
	}

	return sortKey;
}


function InsertSorted(newElement, container)
{
	var nodes = container.childNodes;
	var high, low, mid;

	if(nodes.length==0)
	{
		container.appendChild(newElement);
		return;
	}
	if(newElement.sortKey < nodes[0].sortKey)
	{
		container.insertBefore(newElement, nodes[0]);
		return;
	}
	if(newElement.sortKey >= nodes[nodes.length-1].sortKey)
	{
		container.appendChild(newElement);
		return;
	}
	high = nodes.length;
	low = 0;

	while(high-low>1)
	{
		mid=Math.round((high-low)/2)+low;
		if(newElement.sortKey > nodes[mid].sortKey)
		{
			low=mid;
		}
		else if(newElement.sortKey < nodes[mid].sortKey)
		{
			high=mid;
		}
		else
		{
			container.insertBefore(newElement, nodes[mid]);
			return;
		}
	}
	container.insertBefore(newElement,nodes[high]);
}



function pingMetric(ping)
{
	//if (ping > 500) return "est&nbsp;";

	var lineColor= "#888";
	if (ping > 200)
		lineColor="#f66";
	else if (ping > 100)
		lineColor="#ff6";
	else if (ping < 100)
		lineColor="#6f6";

	if (ping==0)
	{
		return returnVal = "<div style=\"font-size: 10px; height: 5px; float: right;\" title=\"User needs to port forward\">No connection</div>"+
		//"<div style=\"font-size: 5px; width: 50px; height: 5px; margin-top: 7px; background-color: #eee; float: left;\" title=\"est\">"+
		"<div style=\"font-size: 5px; height: 5px; width: 0px; background-color: #888; float: left;\"></div>"/*+
		"</div>"*/;
	}
	else
	{
		return returnVal= /*"<div style=\"font-size: 10px; height: 5px; float: right;\">"+ping+" ms</div>"+*/
			"<div style=\"font-size: 5px; width: 50px; height: 5px; margin-top: 7px; background-color: #eee; float: left;\" title=\""+ping+" ms\">"+
			"<div style=\"font-size: 5px; height: 5px; width: "+(50-(ping < 400 ? (ping/400*50) : 50))+"px; background-color: "+lineColor+"; float: left;\">"+
			"</div>"+
			"</div>";
	}
}

function showArenaView()
{
	// if we are in chat, Switch to Main Arena
	if (curVector=='') switchArena('Arena');

	toggleNavCont('nav');
}

function kaiClientStatus(bits)
{
	if (bits[1]=="Authentication Failed..") showLogin();

	if (bits[1]=="Querying orbital mesh.." || bits[1]=="Requerying orbital mesh..")
	{
		$('initBoxContent').innerHTML=bits[1];
		$('blackScreen').style.display='block';
		$('initBox').style.display='block';
	}

	if (bits[1]=="Attaching to Orbital")
	{
		$('initBoxContent').innerHTML=bits[1];
		$('blackScreen').style.display='block';
		$('initBox').style.display='block';
	}

  if (bits[1] == '') {
    kaiClientDetach();
  }
}

/**
 * Fired upon the engine sending the detach signal which gives us time to shut the show
 * down and close the browser tab/window.
 */
function kaiClientDetach() {
  $('initBoxContent').innerHTML = 'Detached from engine..';
  $('blackScreen').style.display = 'block';
  $('initBox').style.display = 'block';
  p = null;

  if (metricsInterval) {
    clearInterval(metricsInterval);
  }

  setTimeout('window.close()', 1000);
}


function showLogin()
{
	// attempt to autologin
	if (firstLogin==false && $('username').value != '' && $('password').value != '')
	{
		doLogin();
		return;
	}

	$('blackScreen').style.display='block';
	$('loginBox').style.display='block';

	// Auto-focus on the username field
	setTimeout(function() {
		$('username').focus();
	}, 1);
}

function addFoundConsole(mac) {
  if (myConsoles.indexOf(mac) === -1) {
    myConsoles += mac + ';';
  }
}

function addFoundConsoleRemote(player, mac, console) {
  player = player.toLowerCase();

  if (allPlayers[player] && allPlayers[player].consoles.indexOf(mac) === -1) {
    if (console !== false) {
      allPlayers[player].consoles += mac + '|' + console + ';';
    } else {
      allPlayers[player].consoles += mac + ';';
    }
  }
}

function consoleByMac(mac)
{
	var found='';
	for (var name in confdata)
	{
		if (name.indexOf('ConsoleMACs_') !== -1)
			if (confdata[name].indexOf(mac.substring(0,5)) !== -1 && mac !== '') found=name.substring(name.indexOf('_')+1);
	}

	return found;
}

/**
 * Displays the metrics panel for general information and console detection.
 *
 * @param {Array} bits Command bits from the engine
 */
function showMetrics(bits) {
  bits.shift();

  if (metrics === null) {
    metrics = bits;

    var parts = bits[4].split('.');
    engineVersion = (parts[0] << 16) + (parts[1] << 8) + parseInt(parts[2]);

    return;
  }

  $('panelInfoContent').innerHTML = '';

  var panelContent = '';

  // The order of these metrics is 100% important, changing them will result in misaligned
  // values appearing next to them.
  var metricDetails = [
    'Orbital Name',
    'Reachable',
    'Public IP',
    'Public Port',
    'Engine Version',
    'PSSDK/WinPcap',
    'Signed By',
    'Ethernet Adapter',
    'Locked',
    'Up Engine Traffic',
    'Down Engine Traffic',
    'Chat Traffic',
    'Down Chat Traffic',
    'Up Orb Traffic',
    'Down Orb Traffic',
    'PSSDK/WinPcap (again?)',
    'Mac Cache Entrie',
    'Broadcast Traffic Inbound',
    'Broadcast Traffic Outbound',
    'Unicast Traffic Inbound',
    'Unicast Traffic Outbound',
    'Wireless SSID',
  ];

  for (var i = 0, l = metricDetails.length; i < l; i++) {
    panelContent += '<tr>';
    panelContent += '  <td>' + metricDetails[i] + '</td>';
    panelContent += '  <td>' + (bits.shift() || 'n/a') + '</td>';
    panelContent += '</tr>';
  }

  $('panelInfoContent').innerHTML += '<table id="metricDetails">' + panelContent + '</table>';

  // Found consoles
  $('panelInfoContent').innerHTML += "<br><br>\nFound Consoles: <br><br>\n";

  var bits = myConsoles.split(';');

  for (var x = 0; x < bits.length; x++) {
    var mac     = bits[x];
    var console = consoleByMac(mac);

    if (console && console.length) {
      var failedClient  = failedDHCPClients.indexOf(mac) !== -1;
      var failedConsole = failedClient ? ' failedConsole' : '';
      var failedMessage = '';
      var xboxMatches   = console.match(xboxRegExp);

      debug('Adding console to metrics, mac address: ' + mac + ' Failed? ' + failedClient);

      if (failedClient) {
        failedMessage = '<span class="failedError">Wrong IP detected!</span>';
      }

      $('panelInfoContent').innerHTML += "<div class=\"foundConsoles" + failedConsole + "\">" +
        "<img src=\"http://client.teamxlink.co.uk/media/avatars_50/console/" +
        (xboxMatches !== null ? ('XBox ' + RegExp.$1) : console).trim() +
        ".jpg\">" +
        console + '<br><span class="consoleMac">' + mac + "</span>" +
        failedMessage +
        "</div>\n";
    }
  }

  if ($('panelInfo').style.display !== 'block') {
    revealInfoPanel();
  }

  // Start a never ending interval for the metrics panel, this allows us to update
  // it in real-time compared to the user having to continually open and close it.
  if (metricsInterval === null) {
    metricsInterval = setInterval("sendToEngine('KAI_CLIENT_GET_METRICS	');", 1000);
  }
}

function checkDisconnect() {
  var tmp = new Date();

  if (tmp.getTime() - lastPollResponse > maxNoPollTimeout) {
    $('blackScreen').style.display = 'block';
    $('errorBox').style.display = 'block';
  }
}

function setUserAndConfig(player) {
  $('initBox').style.display = 'none';
  $('blackScreen').style.display = 'none';

  confdata = {};
  whoAmI = player;

  // get version details
  sendToEngine("KAI_CLIENT_GET_URL	client.teamxlink.co.uk	/connector/webuiconfig.php?action=init&username=" +
    player +
    "&sk=" + sessionkey +
    "	");

  // if this is a new login, switch the Main Arena
  //if (firstLogin===true) switchArena('Arena');
  if (firstLogin === true) {
    switchArena('');
    sendToEngine('KAI_CLIENT_CHATMODE	General Chat	');
    $('arenaCurrent').innerHTML = "General Chat";
  }

  // send request for metrics... we will grab the engine version from this
  sendToEngine('KAI_CLIENT_GET_METRICS	');
}

function setUserAndConfig_process(bits) {
  var content = bits[4].split("\n");
  for (var x = 0; x < content.length; x++) {
    var key = unescape(content[x].substring(0, content[x].indexOf(":")));
    var val = unescape(content[x].substring(content[x].indexOf(":") + 1));
    if (key != '' && val != '') confdata[key] = val;
  }

  // check version number
  if (confdata['version'] > version) {
    //alert("Your version of the web UI is currently out of date.  Please click OK to proceed to the upgrade site.");
    //document.location.href="http://client.teamxlink.co.uk/webui.php";//404, do not use
    sendToEngine("KAI_CLIENT_UPGRADE	");
    $('initBoxContent').innerHTML = "Upgrading Web UI";
    $('blackScreen').style.display = 'block';
    $('initBox').style.display = 'block';
  }

  // populate favourite arenas
  clearDivs('kaiFavs');
  if (confdata['favourites']) {
    var tmp = confdata['favourites'].split(";");
    for (var x = 0; x < tmp.length; x++) {
      if (tmp[x]) favAdd(tmp[x]);
      //alert(tmp[x]);
    }
    //alert(confdata['favourites']);
  }
}

function changeStatus(stat) {
  sendToEngine("KAI_CLIENT_ARENA_STATUS\t" + stat + "\t1\t");
}

function doLogin() {
  firstLogin = true;

  $('blackScreen').style.display = 'none';
  $('loginBox').style.display = 'none';

  var username = $('username').value;
  var password = $('password').value.replace(/(\n+|\r+)/g, '');

  sendToEngine("KAI_CLIENT_LOGIN\t" + username + "\t" + password + "\t");
}

function displayCreateArena()
{
	$('blackScreen').style.display='block';
	tmp  = "<form name=\"formCreateArena\" method=\"post\" autocomplete=\"off\">\n";
	tmp += "<br><br><br><br><table class=\"tableCreatePrivateArena\"><tr><td colspan=\"2\" >"+ui_strings['createPrivate']+"<br><br></td></tr>";
	tmp += '<tr><td>'+ui_strings['arenaPass']+"</td><td><input type=\"password\" id=\"fpass\" value=\"\" "+
		"onkeydown=\"if (isKey(event,enterKeyAscii)){ $('blackScreen').style.display='none'; $('dialogBox').style.display='none'; "+
		"makeArena(); return false; }\" ></td></tr>\n";
	tmp += '<tr><td>'+ui_strings['maxPlayers']+"</td><td><input type=\"text\" id=\"fmax\" value=\"16\" "+
		"onkeydown=\"if (isKey(event,enterKeyAscii)){ $('blackScreen').style.display='none'; $('dialogBox').style.display='none'; "+
		"makeArena(); return false; }\" ></td></tr>\n";
	tmp += '<tr><td>'+ui_strings['descript']+"</td><td><input type=\"text\" id=\"fdescript\" value=\"\" "+
		"onkeydown=\"if (isKey(event,enterKeyAscii)){ $('blackScreen').style.display='none'; $('dialogBox').style.display='none'; "+
		"makeArena(); return false; }\"></td></tr>\n";
	tmp += "<tr><td>&nbsp;</td><td><input type=\"button\" value=\""+ui_strings['create']+"\" onclick=\"";
	tmp += "$('blackScreen').style.display='none'; $('dialogBox').style.display='none'; makeArena();\"></td></tr>";
	tmp += "</table></form>";

	$('dialogBoxContent').innerHTML=tmp;

	$('blackScreen').style.display='block';
	$('dialogBox').style.display='block';
	$('fpass').focus();
}



function makeArena()
{
	if($('fmax').value.replace(/\D+/g,'')=='')
	{
		alert(ui_strings['errorMaxPlayers']);
		return;
	}

	var arenaDescript =encodeURIComponent($('fdescript').value);
	arenaDescript=arenaDescript.replace(/</g,"&lt;");
	arenaDescript=arenaDescript.replace(/\x02/g,";");

	sendToEngine('KAI_CLIENT_CREATE_VECTOR	'+$('fmax').value+'	'+arenaDescript+'	'+$('fpass').value+'	');
}



function displayEnterPassword(vector)
{
	$('blackScreen').style.display='block';
	tmp  = "<div class=\"passwordRequired\"><br><br><br>Password Required:<br><br>";
	tmp += "Password: <input type=\"password\" id=\"fapass\" value=\"\" ";
	tmp += "onkeyup=\"if (isKey(event,enterKeyAscii)){ switchArenaPrivate( '"+vector+"',$('fapass').value ); ";
	tmp += "$('blackScreen').style.display='none'; $('dialogBox').style.display='none'; }\">";
	tmp += "<input type=\"button\" value=\"Enter\" onclick=\"switchArenaPrivate( '"+vector+"',$('fapass').value ); ";
	tmp += "$('blackScreen').style.display='none'; $('dialogBox').style.display='none'; \">";
	tmp += "</div>";

	$('dialogBoxContent').innerHTML=tmp;

	$('blackScreen').style.display='block';
	$('dialogBox').style.display='block';
	$('fapass').focus();
}



/**
 * Logs out the given input text to the debug console.
 *
 * @param {string} txt Text to log out
 */
function debug(txt) {
  if (debugPlay === false) {
    return;
  }

  if (
    (
      $('hidePing').checked !== false &&
      (
        txt.indexOf('KAI_CLIENT_CONTACT_PING;') !== -1 ||
        txt.indexOf('KAI_CLIENT_ARENA_PING;') !== -1
      )
    ) || (
      $('hideChat').checked !== false && txt.indexOf('KAI_CLIENT_CHAT;') != -1
    )
  ) {
    return;
  }

  var debugMax = 1000;
  var countDiv = $('debug').getElementsByTagName('div').length;

  if (countDiv > debugMax) {
    $('debug').removeChild($('debug').childNodes[countDiv - 1]);
  }

  if (txt) {
    var divNew = document.createElement('div');
    divNew.innerHTML = txt;

    if ($('debug').firstChild == null) {
      $('debug').appendChild(divNew);
    } else {
      $('debug').insertBefore(divNew, $('debug').firstChild);
    }
  }
}

function debugPause() {
	debugPlay = debugPlay ? false : true;
}



function checkAvatar(ele)
{
	if ($(ele).naturalWidth==0)
		$(ele).src='http://client.teamxlink.co.uk/media/avatars_50/default.jpg';
}

function changeArenaIcon(icon)
{
	var a=new AjaxObject101();
	a.funcDone=function(http){ changeArenaIcon_process(http); };
	a.sndReq('get',icon,'', 20000);
}

function changeArenaIcon_process(r)
{
	if (r.status==200)
		$('arenaIcon').value=r.responseText;
	else
		$('arenaIcon').src='http://client.teamxlink.co.uk/media/avatars_50/default.jpg';
}


function isKey(e,ascii)
{
	if (!e) var e = window.event;
	if (e.keyCode == ascii )
		return true;
	else
		return false;
}

function asciiToHex(str)
{
	var returnVal='';
	for (var i=0; i< str.length; i++)
			returnVal += str.charCodeAt(i).toString(16);
	return returnVal;
}

function hexToAscii(str)
{
	return unescape(str);
}

function objReassign_myNode(obj, newKey)
{
	var insertPos=0;

	// now the tricky part... figuring out alphabetical position
	var tmpArray= [];

	for (var name in obj) {
	tmpArray[tmpArray.length] = name;
}

	// sort array
	tmpArray = tmpArray.sort(function(a, b) {
		a = a.replace(/\s/g, '_');
		b = b.replace(/\s/g, '_');

		return a > b ? 1 : -1;
	});

	// find the position of this new guy and reassign all node numbers at the same time
	var insertPos=0;
	for (var x=0; x < tmpArray.length; x++)
	{
		if (tmpArray[x]==newKey.toLowerCase()) insertPos=x;

		obj[tmpArray[x].toLowerCase()].myNode=x;
	}

	if (newKey)	return insertPos;
}



function objPropCount(obj)
{
	var count=0;
	for (var name in obj)
	{
		count++;
	}

	return count;
}



function clearDivs(ele)
{
	var numChildNodes=$(ele).childNodes.length;
	for (var x=0; x < numChildNodes; x++)
	{
		$(ele).removeChild($(ele).childNodes[0]);
	}

/*
	var numDivs=$(ele).getElementsByTagName('div').length;
	for (var x=0; x < numDivs; x++)
	{
		$(ele).removeChild($(ele).childNodes[0]);
	}
*/
}


function toggleNavCont(t)
{
	if (t=="nav")
	{
		$('contacts').style.display='none';
		$('kaiVectors').style.display='block';
		$('kaiFavs').style.display='none';
//		$('btnNavNav').disabled=true;
		$('btnNavCont').disabled=false;
		$('btnNavFav').disabled=false;
	}

	if (t=="cont")
	{
		$('contacts').style.display='block';
		$('kaiVectors').style.display='none';
		$('kaiFavs').style.display='none';
//		$('btnNavNav').disabled=false;
		$('btnNavCont').disabled=true;
		$('btnNavFav').disabled=false;

	}

	if (t=="fav")
	{
		$('contacts').style.display='none';
		$('kaiVectors').style.display='none';
		$('kaiFavs').style.display='block';
//		$('btnNavNav').disabled=false;
		$('btnNavCont').disabled=false;
		$('btnNavFav').disabled=true;

	}


}



function doNothing()
{
	// do nothing
}

function objGetVal(obj, k, prop)
{
	if (obj[k]) return obj[k][prop];
}

function domReadyState() {
  setTimeout('soundAdd();', 500);

  resizeKai();
  addEmoticons();
  addLanguage();
  engineAttach();
  poll();
  updateArenaCommands();

  // Bind a click handler to the logo
  document.querySelector('#logo').addEventListener('click', function () {
    document.location.href = '/config.htm?ui=true';
	});

  // Bind a click handler to the config button
  document.querySelector('#btnConfig').addEventListener('click', function () {
    document.location.href = '/config.htm?ui=true';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', domReadyState);
} else {
  domReadyState();
}

window.addEventListener('resize', resizeKai);

var iconSound;
var soundContainer;
var soundMuted = false;

function soundAdd() {
  if (allowSounds === false) {
    return;
  }

  if (!iconSound) {
    iconSound = document.querySelector('#iconSound');
  }

  iconSound.style.display = 'block';
}

function soundPlay(sound) {
  if (!soundContainer) {
    soundContainer = document.querySelector('#soundContainer');
  }

  // Create the audio player in the background
  var audioPath = getAudioPathForKey(sound);

  if (!audioPath) {
    return;
  }

  var player = '<audio autoplay' + (soundMuted ? ' muted' : '') + '>' +
    '  <source src="' + audioPath + '.mp3" type="audio/mp3">' +
    '  <source src="' + audioPath + '.ogg" type="audio/ogg">' +
    '</audio>';

  soundContainer.innerHTML = player;

  soundContainer.querySelector('audio').addEventListener('ended', function () {
    this.parentNode.removeChild(this);
  });
}

function getAudioPathForKey(sound) {
  var path = false;

  for (var i = 0; i < Sounds.length; i++) {
    var s = Sounds[i].split(';');

    if (s[0].indexOf(sound) === 0) {
      path = s[1];
      break;
    }
  }

  return path;
}

function soundToggle() {
  if (iconSound.className.indexOf('Off') !== -1) {
    iconSound.className = iconSound.className.replace('Off', '');
    soundMuted = false;
  } else {
    iconSound.className = iconSound.className + 'Off';
    soundMuted = true;
  }
}

function resizeKai() {
  var curH = pageHeight() > 400 ? pageHeight() : 400;
  var chatW = pageWidth() - 480;

  $('bigAssContainer').style.height = curH - 20 + 'px';

  $('panelLeft').style.height = curH - 20 + 'px';
  $('panelCenter').style.height = curH - 20 + 'px';
  $('panelCenter').style.width = chatW + 'px';
  $('panelRight').style.height = curH - 20 + 'px';

  $('chatContainer').style.height = curH - 114 + 'px';
  $('chat').style.height = curH - 150 + 'px';
  $('allPlayers').style.height = curH - 114 + 'px';
  $('contacts').style.height = curH - 114 + 'px';
  $('kaiVectors').style.height = curH - 114 + 'px';
  $('kaiFavs').style.height = curH - 114 + 'px';

  $('msg').style.width = chatW - 60 + 'px';
}

function clearMetricsInterval() {
  if (metricsInterval !== null) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
}

function infoPanelVisible() {
  return $('panelInfo').style.display === 'block';
}

function revealInfoPanel() {
  $('panelInfo').style.height = '0px';
  $('panelInfo').style.display = 'block';

  for (var x = 0; x <= 35; x++) {
    setTimeout("$('panelInfo').style.height = '" + (x * 10) + "px'", x * 10);
  }
}

function hideInfoPanel() {
  $('panelInfo').style.height = '300px';

  // Cancel the metrics interval
  clearMetricsInterval();

  for (var x = 0; x <= 30; x++) {
    setTimeout("$('panelInfo').style.height='" + ((30 - x) * 10) + "px'", x * 10);
  }

  setTimeout("$('panelInfo').style.display='none';", (x * 1) * 10);
}


function addEmoticons() {
  $('emotIcons').innerHTML = "<p style=\"height: 10px; line-height: 10px;\"> </p>";

  for (var x = 0; x < Emoticons.length; x++) {
    $('emotIcons').innerHTML += "<div class=\"emoticon\" " +
      "onclick=\"$('msg').value+=' " + Emoticons[x][0] + "'; $('emotIcons').style.display='none'; $('msg').focus();\" " +
      "onmouseover=\"this.style.border='1px solid #09c'\" onmouseout=\"this.style.border='1px solid #000'\" " +
      "title=\"" + Emoticons[x][0] + "\">" +
      "<img src='" + Emoticons[x][1] + "' />" +
      "</div>";
  }
}

function addLanguage()
{
	for (var name in ui_strings)
	{
		if ($(name)!==null)
		{
			if ($(name).type=='button')
			{
				$(name).value=ui_strings[name];
			}
			else if ($(name).type=='option')
			{
				$(name).value=ui_strings[name];
			}
			else
			{
				$(name).innerHTML=ui_strings[name];
			}
		}
	}
}


/**
*
*  UTF-8 data encode / decode
*  http://www.webtoolkit.info/
*
**/

var Utf8 = {

		// public method for url encoding
		encode : function (string) {
				string = string.replace(/\r\n/g,"\n");
				var utftext = '';

				for (var n = 0; n < string.length; n++) {

						var c = string.charCodeAt(n);

						if (c < 128) {
								utftext += String.fromCharCode(c);
						}
						else if((c > 127) && (c < 2048)) {
								utftext += String.fromCharCode((c >> 6) | 192);
								utftext += String.fromCharCode((c & 63) | 128);
						}
						else {
								utftext += String.fromCharCode((c >> 12) | 224);
								utftext += String.fromCharCode(((c >> 6) & 63) | 128);
								utftext += String.fromCharCode((c & 63) | 128);
						}

				}

				return utftext;
		},

		// public method for url decoding
		decode : function (utftext) {
				var string = '';
				var i = 0;
				var c = c1 = c2 = 0;

				while ( i < utftext.length ) {

						c = utftext.charCodeAt(i);

						if (c < 128) {
								string += String.fromCharCode(c);
								i++;
						}
						else if((c > 191) && (c < 224)) {
								c2 = utftext.charCodeAt(i+1);
								string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
								i += 2;
						}
						else {
								c2 = utftext.charCodeAt(i+1);
								c3 = utftext.charCodeAt(i+2);
								string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
								i += 3;
						}

				}

				return string;
		}

}


function strReplace()
{
	for (var x=1; x < arguments.length; x++)
	{
		arguments[0]=arguments[0].replace("%"+x+"%", arguments[x]);
	}

	return arguments[0];
}

Emoticons.push(Array(':angry:','/img/emoticons/angry.gif'));
Emoticons.push(Array(':arrr:','/img/emoticons/arrr.gif'));
Emoticons.push(Array(':awe:','/img/emoticons/awe.gif'));
Emoticons.push(Array(':blink:','/img/emoticons/blink.gif'));
Emoticons.push(Array(':boogie:','/img/emoticons/boogie.gif'));
Emoticons.push(Array(':bored:','/img/emoticons/bored.gif'));
Emoticons.push(Array(':censored:','/img/emoticons/censored.gif'));
Emoticons.push(Array(':cheers:','/img/emoticons/cheers.gif'));
Emoticons.push(Array(':cheerup:','/img/emoticons/cheerup.gif'));
Emoticons.push(Array(':cool:','/img/emoticons/cool.gif'));
Emoticons.push(Array(':cry:','/img/emoticons/cry.gif'));
Emoticons.push(Array(':dunno:','/img/emoticons/dunno.gif'));
Emoticons.push(Array(':fu:','/img/emoticons/fu.gif'));
Emoticons.push(Array(':hahano:','/img/emoticons/hahano.gif'));
Emoticons.push(Array(':hmm:','/img/emoticons/hmm.gif'));
Emoticons.push(Array(':huh:','/img/emoticons/huh.gif'));
Emoticons.push(Array(':ignore:','/img/emoticons/ignore.gif'));
Emoticons.push(Array(':lick:','/img/emoticons/lick.gif'));
Emoticons.push(Array(':lol:','/img/emoticons/lol.gif'));
Emoticons.push(Array(':loser:','/img/emoticons/loser.gif'));
Emoticons.push(Array(':nana:','/img/emoticons/nana.gif'));
Emoticons.push(Array(':ninja:','/img/emoticons/ninja.gif'));
Emoticons.push(Array(':ohmy:','/img/emoticons/ohmy.gif'));
Emoticons.push(Array(':poke:','/img/emoticons/poke.gif'));
Emoticons.push(Array(':psycho:','/img/emoticons/psycho.gif'));
Emoticons.push(Array(':razz:','/img/emoticons/razz.gif'));
Emoticons.push(Array(':roll:','/img/emoticons/roll.gif'));
Emoticons.push(Array(':sad:','/img/emoticons/sad.gif'));
Emoticons.push(Array(':scared:','/img/emoticons/scared.gif'));
Emoticons.push(Array(':shout:','/img/emoticons/shout.gif'));
Emoticons.push(Array(':thumbsup:','/img/emoticons/thumbsup.gif'));
Emoticons.push(Array(':unsure:','/img/emoticons/unsure.gif'));
Emoticons.push(Array(':yahoo:','/img/emoticons/yahoo.gif'));
Emoticons.push(Array(':yammer:','/img/emoticons/yammer.gif'));
Emoticons.push(Array(':yawn:','/img/emoticons/yawn.gif'));
Emoticons.push(Array(':zzz:','/img/emoticons/zzz.gif'));
Emoticons.push(Array(':p','/img/emoticons/tongue.gif'));
Emoticons.push(Array(':P','/img/emoticons/tongue.gif'));
Emoticons.push(Array(':)','/img/emoticons/smile.gif'));
Emoticons.push(Array(';)','/img/emoticons/wink.gif'));
Emoticons.push(Array(':|','/img/emoticons/mellow.gif'));
Emoticons.push(Array(':k','/img/emoticons/mkay.gif'));
Emoticons.push(Array(':D','/img/emoticons/lol.gif'));
Emoticons.push(Array(':(','/img/emoticons/sad.gif'));
Emoticons.push(Array('8)','/img/emoticons/cool.gif'));
Emoticons.push(Array(':s','/img/emoticons/confused.gif'));
Emoticons.push(Array(':S','/img/emoticons/confused.gif'));

Sounds.push('pm;/snd/kaiAlert');
Sounds.push('lolz;/snd/lolz');
Sounds.push('beep;/snd/beep');

var ChatTriggers = {
  "/anoyz": function (x) { x.doAnoyz(); },
  "/movearena": function (x) { x.moveArena(); }
}

function trace(msg) {
  if (typeof (console) != 'undefined') {
    console.log(msg);
  }
}

var default25 = '' +
  '/9j/4AAQSkZJRgABAQEASABIAAD/4QCARXhpZgAATU0AKgAAAAgABQESAAMAAAABAAEAAAEaAAUA' +
  'AAABAAAASgEbAAUAAAABAAAAUgEoAAMAAAABAAIAAIdpAAQAAAABAAAAWgAAAAAAAABIAAAAAQAA' +
  'AEgAAAABAAKgAgAEAAAAAQAAABmgAwAEAAAAAQAAABkAAAAA/9sAQwACAQECAQECAgECAgICAgMF' +
  'AwMDAwMGBAQDBQcGBwcHBgYGBwgLCQcICggGBgkNCQoLCwwMDAcJDQ4NDA4LDAwL/9sAQwECAgID' +
  'AgMFAwMFCwgGCAsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsL' +
  'CwsL/8AAEQgAGQAZAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//E' +
  'ALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJ' +
  'ChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeI' +
  'iYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq' +
  '8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQH' +
  'BQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJico' +
  'KSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZ' +
  'mqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/a' +
  'AAwDAQACEQMRAD8A/TDx1+1N8B/2WfBXw78P/EXwrpXiDxr4g8O2d/HpOmaNZzXjRGFQZ5nmKIis' +
  'wYAu4ZiGwDgkafws/bQ/Zt+NHwN8ReOPh7oHhq4j8KX6aTq2ky6PZrf2F6+PLhkC7kw2ciRXZCAx' +
  'DHaQPyG/4KYeAfGP7PX/AAUW8P8Aj79oPwreeJfhR4+8N6S+gX32f7XYrJFpVvB9luI1ztMTrI+G' +
  'G0iVW55x7b+w78ddP8V614yvPCGjx6Y7x6PZado2naYIX1dhNMhkChVXZGt4qh2OCX2jNfIcQ53m' +
  'WXzqUcHg5TtSlNVPsprRLbX3rLfdpH1WW5JgKuXrMsbjYU4qpGDi3Z+80r3vpo77PRH6T/CD43/C' +
  'L4ofFGz8IXfgbwfY6rq1u9xpzw2drdW91sXc8RcRKUkCgnaRyFPPavjH+xrH/nwsv+/C/wCFewfs' +
  'va5c/ED9tjwxoPjG3n8My+EhPqpt9ShNvNe3H2do0toVI5cJO0zLwQgU4IOR5PRwTmmPznLFicyh' +
  'y1HKStazstrro9+m1jg4gw2BweNlQy+sqkI2TafMlLqr+XXzNn9q/wDYV+PPxp+IXhXxd8JbPSvF' +
  'PhG68G6PZWVq+qrZ3OkNHboZAqyDHzSkyh1OckA/dFReBf8Aglb+0T8WPinH4w+Ker+Cfh7e2i74' +
  'TAX1KWWZYI4Yz5cexIxmJZDhyN3QYArD8Pf8gOz/AOveP/0EVcr9fr8cZliMr/siXIqXI6ekEpcj' +
  'tdX8++/W9z4mvw/g8TUlUqptvzf6a/iex+C/+CV3xbf43+FPFHxL+JvhmSHQNdi126l0/T7j7Zfy' +
  'rL5knLvtQyEuGPIAcgDHFeO7v+mdIa8fr4LBZfQy+Mo0FZSd3q3d/Ns68uyrDZVGUMNGyk7vVu77' +
  '6tn/2Q==';

/* eslint-enable */
