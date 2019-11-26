/* eslint-disable */

function configPopulate() {
  document.title = ui_strings['ID_CONFIG_TITLE'];

  // Update the language on the page
  for (var name in ui_strings) {
    if ($(name) !== null) {
      if ($(name).type === 'button') {
        $(name).value = ui_strings[name];
      } else {
        $(name).innerHTML = ui_strings[name];
      }
    }
  }

  // Add the default profiles
  var profiles = {
    '': '',

    'ID_CONFIG_NORMAL'    : ui_strings['ID_CONFIG_NORMAL'],
    'ID_CONFIG_ENGINE_PC' : ui_strings['ID_CONFIG_ENGINE_PC']
  };

  for (var name in profiles) {
    var elOptNew = document.createElement('option');
    elOptNew.text = profiles[name];
    elOptNew.value = name;

    $('configProfile').add(elOptNew, null);
  }

  // Add the character sets
  var encodings = {
    '0'   : ui_strings['ID_CONFIG_DEFAULT'],
    '932' : ui_strings['ID_CONFIG_JAPANESE'],
    '950' : ui_strings['ID_CONFIG_CHINESE_TRAD'],
    '936' : ui_strings['ID_CONFIG_CHINESE_SIMP'],
    '949' : ui_strings['ID_CONFIG_KOREAN']
  };

  var kaiCodepage = $('kaiCodepage');

  for (var name in encodings) {
    var elOptNew = document.createElement('option');
    elOptNew.text = encodings[name];
    elOptNew.value = name;

    kaiCodepage.add(elOptNew, null);
  }

  for (var x = 0; x < kaiCodepage.options.length; x++) {
    if (kaiCodepage.options[x].value == engine_settings['kaiCodepage']) {
      kaiCodepage.options[x].selected = true;
    }
  }

  // Add the language list
  var kaiLanguage = $('kaiLanguage');

  for (var name in language_list) {
    var elOptNew = document.createElement('option');
    elOptNew.text = language_list[name];
    elOptNew.value = name;

    kaiLanguage.add(elOptNew, null);
  }

  for (var x = 0; x < kaiLanguage.options.length; x++) {
    if (kaiLanguage.options[x].value == engine_settings['kaiLanguage']) {
      kaiLanguage.options[x].selected = true;
    }
  }

  // Add username
  $('kaiUsername').value = engine_settings['kaiUsername'];
  $('kaiPassword').value = engine_settings['kaiPassword'];

  if (typeof engine_keychain !== 'undefined' && engine_keychain === true) {
    $('hasKeyChain').style.display = 'block';
  }

  // Add close ui in...
  var killtime = {
    0  : ui_strings['ID_CONFIG_NEVER'],
    30 : ui_strings['ID_CONFIG_30'],
    60 : ui_strings['ID_CONFIG_60']
  };

  var kaiTimeout = $('kaiTimeout');

  for (var name in killtime) {
    var elOptNew = document.createElement('option');
    elOptNew.text = killtime[name];
    elOptNew.value = name;

    kaiTimeout.add(elOptNew, null);
  }

  for (var x = 0; x < kaiTimeout.options.length; x++) {
    if (kaiTimeout.options[x].value == engine_settings['kaiTimeout']) {
      kaiTimeout.options[x].selected = true;
    }
  }

  if (engine_settings['kaiAutoLogin'] == 1) $('kaiAutoLogin').checked = true;
  if (engine_settings['kaiUIClose'] == 1) $('kaiUIClose').checked = true;
  if (engine_settings['kaiAcceptRemote'] == 1) $('kaiAcceptRemote').checked = true;
  if (engine_settings['kaiDisableSleep'] == 1) $('kaiDisableSleep').checked = true;

  $('kaiHTTPPassword').value = engine_settings['kaiHTTPPassword'];
  if (engine_settings['kaiLaunchUI'] == 1) $('kaiLaunchUI').checked = true;

  if (engine_settings['kaiDHCPAssignPS2'] == 1) $('kaiDHCPAssignPS2').checked = true;
  if (engine_settings['kaiDHCPAssignPS3'] == 1) $('kaiDHCPAssignPS3').checked = true;
  if (engine_settings['kaiDHCPAssignPS4'] == 1) $('kaiDHCPAssignPS4').checked = true;
  if (engine_settings['kaiDHCPAssignGamecube'] == 1) $('kaiDHCPAssignGamecube').checked = true;
  if (engine_settings['kaiDHCPAssignXBoxOne'] == 1) $('kaiDHCPAssignXBoxOne').checked = true;
  if (engine_settings['kaiDHCPAssignXBoxHomeBrew'] == 1) $('kaiDHCPAssignXBoxHomeBrew').checked = true;
  if (engine_settings['kaiDHCPAssignXBox360HomeBrew'] == 1) $('kaiDHCPAssignXBox360HomeBrew').checked = true;
  if (engine_settings['kaiDHCPAssignSwitch'] == 1) $('kaiDHCPAssignSwitch').checked = true;
  if (engine_settings['kaiEnableXBoxHomeBrew'] == 1) $('kaiEnableXBoxHomeBrew').checked = true;
  if (engine_settings['kaiEnableXBox360HomeBrew'] == 1) $('kaiEnableXBox360HomeBrew').checked = true;

  if (engine_platform === 'windows') {
    $('kaiUI').value = engine_settings['kaiUI'];

    // WebUI or standard GUI radio
    if (engine_settings['kaiWebUI'] == 1) {
      $('configUIweb').checked = true;
    } else {
      $('configUIstandard').checked = true;
    }

    if (engine_settings['kaiProxyAutoDetect'] == 1) {
      $('kaiProxyAutoDetect').checked = true;
      ProxyAutoDetect_Click();
    }

    // Packet Capture radio
    if (engine_settings['kaiLib'] === 'pssdk') {
      $('configPSSDK').checked = true;
    } else {
      $('configWinpcap').checked = true;
    }
  } else {
    $('div_StandardGUI').style.display = 'none';
    $('div_ProxyAutoDetect').style.display = 'none';
    $('div_PacketCaptureEngine').style.display = 'none';
    $('div_DisableSleep').style.display = 'none';
    $('configUIweb').checked = true;
  }

  // Add network adaptors
  adapter_list[''] = ui_strings['ID_CONFIG_AUTODETECT'];

  var kaiAdapter = $('kaiAdapter');

  for (var name in adapter_list) {
    var elOptNew = document.createElement('option');
    elOptNew.text = adapter_list[name];
    elOptNew.value = name.replace(/^Device/, "\\Device\\");

    kaiAdapter.add(elOptNew, null);
  }

  for (var x = 0; x < kaiAdapter.options.length; x++) {
    if (kaiAdapter.options[x].value == engine_settings['kaiAdapter']) {
      kaiAdapter.options[x].selected = true;
    }
  }

  $('kaiPort').value = engine_settings['kaiPort'];
  $('kaiWebUIPort').value = engine_settings['kaiWebUIPort'];
  $('kaiProxyServer').value = engine_settings['kaiProxyServer'];
  $('kaiProxyPort').value = engine_settings['kaiProxyPort'];

  if (engine_settings['kaiPAT'] == 1) {
    $('kaiPAT').checked = true;
  }

  if (engine_settings['kaiPSPMode'] == 1) {
    $('kaiPSPMode').checked = true;
  }
}

function ProxyAutoDetect_Click() {
  if ($('kaiProxyAutoDetect').checked == true) {
    $('kaiProxyServer').disabled = true;
    $('kaiProxyServer').style.backgroundColor = '#aaa';
    $('kaiProxyPort').disabled = true;
    $('kaiProxyPort').style.backgroundColor = '#aaa';
  } else {
    $('kaiProxyServer').disabled = false;
    $('kaiProxyServer').style.backgroundColor = '';
    $('kaiProxyPort').disabled = false;
    $('kaiProxyPort').style.backgroundColor = '';
  }
}

function setDefaultProfile() {
  var curSel = $('configProfile').options[$('configProfile').selectedIndex].value;

  if (curSel === 'ID_CONFIG_NORMAL') {
    $('kaiLaunchUI').checked = true;
    $('kaiUIClose').checked = true;
    $('kaiAcceptRemote').checked = false;
  }

  if (curSel === 'ID_CONFIG_ENGINE_PC') {
    $('kaiLaunchUI').checked = false;
    $('kaiUIClose').checked = false;
    $('kaiAcceptRemote').checked = true;
  }
}

function configSave() {
  var sendArray = {
    'kaiWebUI'                     : $('configUIweb').checked != false ? 1 : 0,
    'kaiUI'                        : $('kaiUI').value,
    'kaiHTTPPassword'              : $('kaiHTTPPassword').value,
    'kaiLaunchUI'                  : $('kaiLaunchUI').checked != false ? 1 : 0,
    'kaiCodepage'                  : $('kaiCodepage').options[$('kaiCodepage').selectedIndex].value,
    'kaiLanguage'                  : $('kaiLanguage').options[$('kaiLanguage').selectedIndex].value,
    'kaiAdapter'                   : $('kaiAdapter').options[$('kaiAdapter').selectedIndex].value,
    'kaiPort'                      : $('kaiPort').value,
    'kaiWebUIPort'                 : $('kaiWebUIPort').value,
    'kaiProxyAutoDetect'           : $('kaiProxyAutoDetect').checked != false ? 1 : 0,
    'kaiDHCPAssignPS2'             : $('kaiDHCPAssignPS2').checked != false ? 1 : 0,
    'kaiDHCPAssignPS3'             : $('kaiDHCPAssignPS3').checked != false ? 1 : 0,
    'kaiDHCPAssignPS4'             : $('kaiDHCPAssignPS4').checked != false ? 1 : 0,
    'kaiDHCPAssignGamecube'        : $('kaiDHCPAssignGamecube').checked != false ? 1 : 0,
    'kaiDHCPAssignXBoxOne'         : $('kaiDHCPAssignXBoxOne').checked != false ? 1 : 0,
    'kaiDHCPAssignSwitch'          : $('kaiDHCPAssignSwitch').checked != false ? 1 : 0,
    'kaiDHCPAssignXBoxHomeBrew'    : $('kaiDHCPAssignXBoxHomeBrew').checked != false ? 1 : 0,
    'kaiDHCPAssignXBox360HomeBrew' : $('kaiDHCPAssignXBox360HomeBrew').checked != false ? 1 : 0,
    'kaiEnableXBoxHomeBrew'        : $('kaiEnableXBoxHomeBrew').checked != false ? 1 : 0,
    'kaiEnableXBox360HomeBrew'     : $('kaiEnableXBox360HomeBrew').checked != false ? 1 : 0,
    'kaiProxyServer'               : $('kaiProxyServer').value,
    'kaiProxyPort'                 : $('kaiProxyPort').value,
    'kaiLib'                       : $('configPSSDK').checked != false ? 'pssdk' : 'winpcap',
    'kaiPAT'                       : $('kaiPAT').checked != false ? 1 : 0,
    'kaiPSPMode'                   : $('kaiPSPMode').checked != false ? 1 : 0,
    'kaiUsername'                  : $('kaiUsername').value,
    'kaiPassword'                  : $('kaiPassword').value,
    'kaiTimeout'                   : $('kaiTimeout').options[$('kaiTimeout').selectedIndex].value,
    'kaiAutoLogin'                 : $('kaiAutoLogin').checked != false ? 1 : 0,
    'kaiUIClose'                   : $('kaiUIClose').checked != false ? 1 : 0,
    'kaiAcceptRemote'              : $('kaiAcceptRemote').checked != false ? 1 : 0,
    'kaiDisableSleep'              : $('kaiDisableSleep').checked != false ? 1 : 0
  }

  var sendSTR = '';
  for (var name in sendArray) {
    sendSTR += (sendSTR != '' ? '&' : '') + name + '=' + sendArray[name];
  }

  // Send the save request to the engine
  var sc = new AjaxObject101();

  sc.funcDone = function (http) {
    configSaveProcess(http);
  };

  sc.sndReq('post', '/connector/saveconfig', sendSTR, 10000);
}

function configSaveProcess(r) {
  if (r.status === 200) {
    if (document.location.href.indexOf('ui=true') === -1) {
      window.close();
      return;
    }

    if (r.responseText.indexOf('RESTART') !== -1) {
      $('initBoxContent').innerHTML = (ui_strings['restartEngine'] != null ? ui_strings['restartEngine'] : 'Please wait while engine restarts');
      $('blackScreen').style.display = 'block';
      $('initBox').style.display = 'block';

      setTimeout("document.location.href='/client.htm';", 2000);
    } else {
      document.location.href = '/client.htm?tick=' + Math.random();
    }
  }
}

window.onload = function () {
  configPopulate();
}

/* eslint-enable */
