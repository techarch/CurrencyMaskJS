// Library: CurrencyMaskJS
//
// Adapted from original work from Dan Switzer (dswitzer@pengoworks.com)
// Original source http://www.pengoworks.com/workshop/js/mask/
// Enhanced by Philippe Monnet (techarch@monnet-usa.com) in 2008-2014
// Last revision: 2014-10-19 (bug fixes)
// Note: this library depends on the jQuery library.
//
// Usage examples:
//      var housePrice_mask = new Mask("$#,###", "number");
//      housePrice_mask.attach($('#housePrice')[0]);
//

function _MaskAPI() {
    this.version = "0.8";
    this.instances = 0;
    this.objects = {};
}
MaskAPI = new _MaskAPI();

function Mask(m, t, r) {
    this.mask = m;
    this.type = (typeof t == "string") ? t : "string";
    this.error = [];
    this.errorCodes = [];
    this.value = "";
    this.logLevel = "info";
    this.strippedValue = "";
    this.allowPartial = false;
    this.id = MaskAPI.instances++;
    this.ref = "MaskAPI.objects['" + this.id + "']";
    this.round = (typeof(r) != 'undefined') ? r : true; // PFM - triggers rounding in numbers
    MaskAPI.objects[this.id] = this;
}

// define the attach(oElement) function
Mask.prototype.attach = function (o) {
    // PFM: Identify IE once and for all
    var ua = navigator.userAgent;
    this.msie = ua.match(/MSIE/g) || ua.match(/Trident/);
    this.msie9AndAbove = false;

    if (this.msie) {
        var ieVersion = 1;
        var re = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
        if (re.exec(ua) != null) {
            ieVersion = parseFloat(RegExp.$1);
        }
        this.msie9AndAbove = (ieVersion >= 9) || ua.match(/Trident/);
    }

    this.webkit = ua.match(/WebKit/g);

    $addEvent(o, "onkeydown", "return " + this.ref + ".isAllowKeyPress(event, this);", true);
    $addEvent(o, "onkeyup", "return " + this.ref + ".getKeyPress(event, this);", true);

    this.target = o; // PFM added
    var m = this; // PFM added

    // PFM : changed the logic for IE9 as the blur event is not triggering a change 
    // (works in all browsers inc. IE8 but not IE9!!!)
    if (this.msie9AndAbove || this.webkit) {
        // PFM: needs to rely on jQuery  
        // 1. Don't reformat the value!
        // 2. Eplicitly trigger the change event too!
        $(o).blur(function () {
            $(this).change();
            m.log('Mask ' + m + ' for input: #' + this.id + ' triggered change event', 'info');
            return true;
        });
    } else {
        $addEvent(o, "onblur", "this.value = " + this.ref + ".format(this.value);" + this.ref + ".target.value=this.value;return this.value;", true);
    }

    this.log('Mask ' + this.mask + ' now attached to input: #' + o.id, 'debug');
}

Mask.prototype.isAllowKeyPress = function (e, o) {
    if (this.type != "string") return true;
    var xe = new qEvent(e);
    if (((xe.keyCode > 47) && (o.value.length >= this.mask.length)) && !xe.ctrlKey) return false;
    return true;
}

Mask.prototype.getKeyPress = function (e, o, _u) {
    this.allowPartial = true;
    var xe = new qEvent(e);

    // PFM: Save current length and current position of the caret
    // so we can set the appropriate caret position
    // later once the mask has been applied     
    var caretPosition = this.getCaretPosition(o);
    var currentLength = o.value.length;

    //	var k = String.fromCharCode(xe.keyCode);
    if ((xe.keyCode > 47) || (_u == true) || (xe.keyCode == 8 || xe.keyCode == 46)) {
        var v = o.value, d;
        // Find out if it is a decimal
        d = (xe.keyCode == 8 || xe.keyCode == 46 || xe.keyCode == 190) ? true : false;

        if (this.type == "number") {
            this.log('Mask for ' + o.id + ' type:' + this.type + ' _u:' + _u + ' key:' + xe.keyCode + ' decoded:' + String.fromCharCode(xe.keyCode)
                        + ' setNumber(' + v + ',' + d + ')', 'debug');
            this.value = this.setNumber(v, d);
        }
        else if (this.type == "date") {
            this.value = this.setDateKeyPress(v, d);
        }
        else {
            this.value = this.setGeneric(v, d);
        }

        o.value = this.value;

        // PFM: Figure out and set the new position of the caret
        // since it could be offset by 1 if the masking shifted 
        // the new character to the right
        var newCaretPosition = (o.value.length > currentLength) ? caretPosition + 1 : caretPosition;
        this.setCaretPosition(o, newCaretPosition);
        this.log('Mask for ' + o.id + ' type:' + this.type + ' _u:' + _u + ' key:' + xe.keyCode + ' decoded:' + String.fromCharCode(xe.keyCode)
                    + ' new value:' + o.value, 'debug');
    } else {
        this.log('Mask for ' + o.id + ' _u:' + _u + ' key:' + xe.keyCode + ' decoded:' + String.fromCharCode(xe.keyCode) + ' ignore', 'debug');
    }
    /* */

    this.allowPartial = false;
    return true;
}


Mask.prototype.getCaretPosition = function (ctrl) {
    var caretStart = 0;
    var aSelection = null;
    var aRange = null;

    // IE Support
    if (this.msie) {
        if (typeof (document.selection) != 'undefined') {
            aSelection = document.selection;
            aRange = aSelection.createRange();
        } else {
            aSelection = window.getSelection();
            if (aSelection != null) {
                aRange = (aSelection.rangeCount > 0)
                            ? aSelection.getRangeAt(0)
                            : null;
                if (aRange == null) {
                    return 0;
                }
            }
        }

        var selLength = aRange.text.length;
        aRange.moveStart('character', -ctrl.value.length);
        caretStart = aRange.text.length - selLength;
        caretEnd = caretStart + aRange.text.length;
    }
    // Firefox support
    else if (ctrl.selectionStart || ctrl.selectionStart == '0')
        caretStart = ctrl.selectionStart;

    return (caretStart);
}

Mask.prototype.setCaretPosition = function (ctrl, iCaretPos) {
    var aSelection = null;
    var aRange = null;

    if (this.msie) {
        // IE Support
        // Create empty selection range
        if (typeof (document.selection) != 'undefined') {
            aSelection = document.selection;
            aRange = aSelection.createRange();
        } else {
            aSelection = window.getSelection();
            if (aSelection != null) {
                aRange = (aSelection.rangeCount > 0)
                            ? aSelection.getRangeAt(0)
                            : null;
                if (aRange != null) {
                    aSelection.removeAllRanges();
                    aSelection.addRange(iCaretPos);
                }
                return;
            }
            return;
        }

        // Move selection start and end to 0 position
        aRange.moveStart('character', -ctrl.value.length);

        // Move selection start and end to desired position
        aRange.collapse(true);
        aRange.moveEnd('character', iCaretPos);
        aRange.moveStart('character', iCaretPos);
        aRange.select();
    }
    // Firefox support
    else if (ctrl.selectionStart || ctrl.selectionStart == '0') {
        ctrl.selectionStart = iCaretPos;
        ctrl.selectionEnd = iCaretPos;
    }
}

Mask.prototype.format = function (s, _r) {
    if (this.type == "number") this.value = this.setNumber(s);
    else if (this.type == "date") this.value = this.setDate(s);
    else this.value = this.setGeneric(s);
    return this.value;
}

Mask.prototype.throwError = function (c, e, v) {
    this.error[this.error.length] = e;
    this.errorCodes[this.errorCodes.length] = c;
    if (typeof v == "string") return v;
    return true;
}

Mask.prototype.setGeneric = function (_v, _d) {
    var v = _v, m = this.mask;
    var r = "x#*", rt = [], nv = "", t, x, a = [], j = 0, rx = { "x": "A-Za-z", "#": "0-9", "*": "A-Za-z0-9" };

    // strip out invalid characters
    v = v.replace(new RegExp("[^" + rx["*"] + "]", "gi"), "");
    if ((_d == true) && (v.length == this.strippedValue.length)) v = v.substring(0, v.length - 1);
    this.strippedValue = v;
    var b = [];
    for (var i = 0; i < m.length; i++) {
        // grab the current character
        x = m.charAt(i);
        // check to see if current character is a mask, escape commands are not a mask character
        t = (r.indexOf(x) > -1);
        // if the current character is an escape command, then grab the next character
        if (x == "!") x = m.charAt(i++);
        // build a regex to test against
        if ((t && !this.allowPartial) || (t && this.allowPartial && (rt.length < v.length))) rt[rt.length] = "[" + rx[x] + "]";
        // build mask definition table
        a[a.length] = { "chr": x, "mask": t };
    }

    var hasOneValidChar = false;
    // if the regex fails, return an error
    if (!this.allowPartial && !(new RegExp(rt.join(""))).test(v)) return this.throwError(1, "The value \"" + _v + "\" must be in the format " + this.mask + ".", _v);
    // loop through the mask definition, and build the formatted string
    else if ((this.allowPartial && (v.length > 0)) || !this.allowPartial) {
        for (i = 0; i < a.length; i++) {
            if (a[i].mask) {
                while (v.length > 0 && !(new RegExp(rt[j])).test(v.charAt(j))) v = (v.length == 1) ? "" : v.substring(1);
                if (v.length > 0) {
                    nv += v.charAt(j);
                    hasOneValidChar = true;
                }
                j++;
            } else nv += a[i].chr;
            if (this.allowPartial && (j > v.length)) break;
        }
    }

    if (this.allowPartial && !hasOneValidChar) nv = "";
    if (this.allowPartial) {
        if (nv.length < a.length) this.nextValidChar = rx[a[nv.length].chr];
        else this.nextValidChar = null;
    }

    return nv;
}

Mask.prototype.setNumber = function (_v, _d) {
    var v = String(_v).replace(/[^\d.-]*/gi, ""), m = this.mask;

    // PFM - If the mask does not include a + or a - then reject the key pressed
    if ((v == "+" || v == "-") && m.indexOf(v) == -1)
        return "";

    // PFM - If data has already been entered then reject any sign indicator (as it should have been typed first!)
    if ((this.value.length > 0) && (v.indexOf("+") != -1 || v.indexOf("-") != -1)) {
        v = v.replace(/\+/g, "");
        v = v.replace(/\-/g, "");
    }

    // PFM - Make sure there's only sign indicator
    v = v.replace(/\+/, "d").replace(/\+/g, "").replace(/d/, "+");
    v = v.replace(/\-/, "d").replace(/\-/g, "").replace(/d/, "-");

    // make sure there's only one decimal point
    v = v.replace(/\./, "d").replace(/\./g, "").replace(/d/, ".");

    // check to see if an invalid mask operation has been entered
    if (!/^[\$]?((\$?[\+-]?([0#]{1,3},)?[0#]*(\.[0#]*)?)|([\+-]?\([\+-]?([0#]{1,3},)?[0#]*(\.[0#]*)?\)))$/.test(m))
        return this.throwError(1, "An invalid mask was specified for the \nMask constructor.", _v);

    if ((_d == true) && (v.length == this.strippedValue.length)) v = v.substring(0, v.length - 1);

    if (this.allowPartial && (v.replace(/[^0-9]/, "").length == 0)) return v;
    this.strippedValue = v;

    if (v.length == 0) v = NaN;
    var vn = Number(v);
    if (isNaN(vn)) return this.throwError(2, "The value entered was not a number.", _v);

    // if no mask, stop processing
    if (m.length == 0) return v;

    // get the value before the decimal point
    var vi = String(Math.abs((v.indexOf(".") > -1) ? v.split(".")[0] : v));
    // get the value after the decimal point
    var vd = (v.indexOf(".") > -1) ? v.split(".")[1] : "";
    var _vd = vd;

    var isNegative = (vn != 0 && Math.abs(vn) * -1 == vn);

    // check for masking operations
    var show = {
        "$": /^[\$]/.test(m),
        "(": (isNegative && (m.indexOf("(") > -1)),
        "+": ((m.indexOf("+") != -1) && !isNegative)
    }
    show["-"] = (isNegative && (!show["("] || (m.indexOf("-") != -1)));


    // replace all non-place holders from the mask
    m = m.replace(/[^#0.,]*/gi, "");

    /*
    make sure there are the correct number of decimal places
    */
    // get number of digits after decimal point in mask
    var dm = (m.indexOf(".") > -1) ? m.split(".")[1] : "";
    if (dm.length == 0) {
        vi = String(Math.round(Number(vi)));
        vd = "";
    } else {
        // find the last zero, which indicates the minimum number
        // of decimal places to show
        var md = dm.lastIndexOf("0") + 1;
        // if the number of decimal places is greater than the mask, then round off
        if (vd.length > dm.length) {
            // PFM - If rounding is on then round otherwise cut off
            if (this.round) {
                // PFM - Prefix with 1 to ensure the rounding is correct if the first decimals are zeroes
                var decs = '1' + vd.substring(0, dm.length + 1);
                var decn = Number(decs);
                var decr = Math.round(Number(decs) / 10); // compensate for the leading 1
                var decrs = String(decr);
                vd = decrs.substring(1); // lop off the leading 1 as we no longer need it
            } else {
                // PFM - lop off the last entered digit
                vd = vd.substring(0, dm.length);
            }
        }
        else {
            // otherwise, pad the string w/the required zeros
            while (vd.length < md) vd += "0";
        }
    }

    /*
    pad the int with any necessary zeros
    */
    // get number of digits before decimal point in mask
    var im = (m.indexOf(".") > -1) ? m.split(".")[0] : m;
    im = im.replace(/[^0#]+/gi, "");
    // find the first zero, which indicates the minimum length
    // that the value must be padded w/zeros
    var mv = im.indexOf("0") + 1;
    // if there is a zero found, make sure it's padded
    if (mv > 0) {
        mv = im.length - mv + 1;
        while (vi.length < mv) vi = "0" + vi;
    }

    // PFM - Reupdated the stripped value
    this.strippedValue = vi + "." + vd;

    /*
    check to see if we need commas in the thousands place holder
    */
    if (/[#0]+,[#0]{3}/.test(m)) {
        // add the commas as the place holder
        var x = [], i = 0, n = Number(vi);
        while (n > 999) {
            x[i] = "00" + String(n % 1000);
            x[i] = x[i].substring(x[i].length - 3);
            n = Math.floor(n / 1000);
            i++;
        }
        x[i] = String(n % 1000);
        vi = x.reverse().join(",");
    }


    /*
    combine the new value together
    */
    if ((vd.length > 0 && !this.allowPartial) ||
        ((dm.length > 0) && this.allowPartial && (v.indexOf(".") > -1) && (_vd.length >= vd.length))) {
        v = vi + "." + vd;
    } else if ((dm.length > 0) && this.allowPartial && (v.indexOf(".") > -1) && (_vd.length < vd.length)) {
        v = vi + "." + _vd;
    } else {
        v = vi;
    }

    if (show["$"]) v = this.mask.replace(/(^[\$])(.+)/gi, "$") + v;
    if (show["+"]) v = "+" + v;
    if (show["-"]) v = "-" + v;
    if (show["("]) v = "(" + v + ")";
    return v;
}

Mask.prototype.setDate = function (_v) {
    var v = _v, m = this.mask;
    var a, e, mm, dd, yy, x, s;

    // split mask into array, to see position of each day, month & year
    a = m.split(/[^mdy]+/);
    // split mask into array, to get delimiters
    s = m.split(/[mdy]+/);
    // convert the string into an array in which digits are together
    e = v.split(/[^0-9]/);

    if (s[0].length == 0) s.splice(0, 1);

    for (var i = 0; i < a.length; i++) {
        x = a[i].charAt(0).toLowerCase();
        if (x == "m") mm = parseInt(e[i], 10) - 1;
        else if (x == "d") dd = parseInt(e[i], 10);
        else if (x == "y") yy = parseInt(e[i], 10);
    }

    // if year is abbreviated, guess at the year
    if (String(yy).length < 3) {
        yy = 2000 + yy;
        if ((new Date()).getFullYear() + 5 < yy) yy = yy - 100;
    }

    // create date object
    var d = new Date(yy, mm, dd);

    if (d.getDate() != dd) return this.throwError(1, "An invalid day was entered.", _v);
    else if (d.getMonth() != mm) return this.throwError(2, "An invalid month was entered.", _v);

    var nv = "";

    for (i = 0; i < a.length; i++) {
        x = a[i].charAt(0).toLowerCase();
        if (x == "m") {
            mm++;
            if (a[i].length == 2) {
                mm = "0" + mm;
                mm = mm.substring(mm.length - 2);
            }
            nv += mm;
        } else if (x == "d") {
            if (a[i].length == 2) {
                dd = "0" + dd;
                dd = dd.substring(dd.length - 2);
            }
            nv += dd;
        } else if (x == "y") {
            if (a[i].length == 2) nv += d.getYear();
            else nv += d.getFullYear();
        }

        if (i < a.length - 1) nv += s[i];
    }

    return nv;
}

Mask.prototype.setDateKeyPress = function (_v, _d) {
    var v = _v, m = this.mask, k = v.charAt(v.length - 1);
    var a, e, c, ml, vl, mm = "", dd = "", yy = "", x, p, z;

    if (_d == true) {
        while ((/[^0-9]/gi).test(v.charAt(v.length - 1))) v = v.substring(0, v.length - 1);
        if ((/[^0-9]/gi).test(this.strippedValue.charAt(this.strippedValue.length - 1))) v = v.substring(0, v.length - 1);
        if (v.length == 0) return "";
    }

    // split mask into array, to see position of each day, month & year
    a = m.split(/[^mdy]/);
    // split mask into array, to get delimiters
    s = m.split(/[mdy]+/);
    // mozilla wants to add an empty array element which needs removed
    for (i = 0; i < s.length; i++) {
        if (s[i].length == 0) {
            s.splice(i, 1);
            i = i - 1;
        }
    }
    // convert the string into an array in which digits are together
    e = v.split(/[^0-9]/);
    for (i = 0; i < e.length; i++) {
        if (e[i].length == 0) {
            e.splice(i, 1);
            i = i - 1;
        }
    }
    // position in mask
    p = (e.length > 0) ? e.length - 1 : 0;
    // determine what mask value the user is currently entering
    c = a[p].charAt(0);
    // determine the length of the current mask value
    ml = a[p].length;

    for (var i = 0; i < e.length; i++) {
        x = a[i].charAt(0).toLowerCase();
        if (x == "m") mm = parseInt(e[i], 10) - 1;
        else if (x == "d") dd = parseInt(e[i], 10);
        else if (x == "y") yy = parseInt(e[i], 10);
    }


    var nv = "";
    var j = 0;

    for (i = 0; i < e.length; i++) {
        x = a[i].charAt(0).toLowerCase();

        if (x == "m") {
            z = ((/[^0-9]/).test(k) && c == "m");
            mm++;
            if ((e[i].length == 2 && mm < 10) || (a[i].length == 2 && c != "m") || (mm > 1 && c == "m") || (z && a[i].length == 2)) {
                mm = "0" + mm;
                mm = mm.substring(mm.length - 2);
            }
            vl = String(mm).length;
            ml = 2;
            nv += mm;
        } else if (x == "d") {
            z = ((/[^0-9]/).test(k) && c == "d");
            if ((e[i].length == 2 && dd < 10) || (a[i].length == 2 && c != "d") || (dd > 3 && c == "d") || (z && a[i].length == 2)) {
                dd = "0" + dd;
                dd = dd.substring(dd.length - 2);
            }
            vl = String(dd).length;
            ml = 2;
            nv += dd;
        } else if (x == "y") {
            z = ((/[^0-9]/).test(k) && c == "y");
            if (c == "y") yy = String(yy);
            else {
                if (a[i].length == 2) yy = d.getYear();
                else yy = d.getFullYear();
            }
            if ((e[i].length == 2 && yy < 10) || (a[i].length == 2 && c != "y") || (z && a[i].length == 2)) {
                yy = "0" + yy;
                yy = yy.substring(yy.length - 2);
            }
            ml = a[i].length;
            vl = String(yy).length;
            nv += yy;
        }

        if (((ml == vl || z) && (x == c) && (i < s.length)) || (i < s.length && x != c)) nv += s[i];
    }

    if (nv.length > m.length) nv = nv.substring(0, m.length);

    this.strippedValue = (nv == "NaN") ? "" : nv;

    return this.strippedValue;
}

// PFM
Mask.prototype.updateFormattedValue = function (value) {
    var formatted_value = this.format(value);
    this.target.value = formatted_value;
    return formatted_value;
}

Mask.prototype.log = function (message, level) {
    if (this.webkit) {
        switch (level) {
            case "debug":
                if (this.logLevel === 'debug')
                    try { console.debug(message); } catch (ex) { var a = 1; }
                break;
            case "error":
                try { console.error(message); } catch (ex) { var a = 1; }
                break;
            case "info":
                if (this.logLevel === 'debug' || this.logLevel === 'info')
                    try { console.info(message); } catch (ex) { var a = 1; }
                break;
            default:
                try { console.debug(message); } catch (ex) { var a = 1; }
                break;
        }
        return message;
    }

    if (this.msie) {
        if (level === this.logLevel ||
            (this.logLevel === 'debug') ||
            (this.logLevel === 'info' && (level === 'info' || level === 'error')))
            try { console.log(message); } catch (ex) { var a = 1; }
    }

    return message;
}

function qEvent(e) {
    // PFM: Added explicit check for the browser agent
    // since IE 8 now implements window.Event
    var ua = navigator.userAgent;
    if (ua.match(/MSIE/g)) {
        // routine for Internet Explorer DOM browsers
        e = window.event;
        this.keyCode = parseInt(e.keyCode, 10);
        this.button = e.button;
        this.srcElement = e.srcElement;
        this.type = e.type;
        if (document.all) {
            this.x = e.clientX + document.body.scrollLeft;
            this.y = e.clientY + document.body.scrollTop;
        } else {
            this.x = e.clientX;
            this.y = e.clientY;
        }
        this.screenX = e.screenX;
        this.screenY = e.screenY;
        this.altKey = e.altKey;
        this.ctrlKey = e.ctrlKey;
        this.shiftKey = e.shiftKey;
    }
    else {
        // routine for NS, Opera, etc DOM browsers
        var isKeyPress = (e.type.substring(0, 3) == "key");

        this.keyCode = (isKeyPress) ? parseInt(e.which, 10) : 0;
        this.button = (!isKeyPress) ? parseInt(e.which, 10) : 0;
        this.srcElement = e.target;
        this.type = e.type;
        this.x = e.pageX;
        this.y = e.pageY;
        this.screenX = e.screenX;
        this.screenY = e.screenY;
        if (document.layers) {
            this.altKey = ((e.modifiers & Event.ALT_MASK) > 0);
            this.ctrlKey = ((e.modifiers & Event.CONTROL_MASK) > 0);
            this.shiftKey = ((e.modifiers & Event.SHIFT_MASK) > 0);
            this.keyCode = this.translateKeyCode(this.keyCode);
        } else {
            this.altKey = e.altKey;
            this.ctrlKey = e.ctrlKey;
            this.shiftKey = e.shiftKey;
        }
    }

    if (this.button == 0) {
        this.setKeyPressed(this.keyCode);
        this.keyChar = String.fromCharCode(this.keyCode);
    }
}

// this method will try to remap the keycodes so the keycode value
// returned will be consistent. this doesn't work for all cases,
// since some browsers don't always return a unique value for a
// key press.
qEvent.prototype.translateKeyCode = function (i) {
    var l = {};
    // remap NS4 keycodes to IE/W3C keycodes
    if (!!document.layers) {
        if (this.keyCode > 96 && this.keyCode < 123) return this.keyCode - 32;
        l = {
            96: 192, 126: 192, 33: 49, 64: 50, 35: 51, 36: 52, 37: 53, 94: 54, 38: 55, 42: 56, 40: 57, 41: 48, 92: 220, 124: 220, 125: 221,
            93: 221, 91: 219, 123: 219, 39: 222, 34: 222, 47: 191, 63: 191, 46: 190, 62: 190, 44: 188, 60: 188, 45: 189, 95: 189, 43: 187,
            61: 187, 59: 186, 58: 186,
            "null": null
        }
    }
    return (!!l[i]) ? l[i] : i;
}

// try to determine the actual value of the key pressed
qEvent.prototype.setKP = function (i, s) {
    this.keyPressedCode = i;
    this.keyNonChar = (typeof s == "string");
    this.keyPressed = (this.keyNonChar) ? s : String.fromCharCode(i);
    this.isNumeric = (parseInt(this.keyPressed, 10) == this.keyPressed);
    this.isAlpha = ((this.keyCode > 64 && this.keyCode < 91) && !this.altKey && !this.ctrlKey);
    return true;
}

// try to determine the actual value of the key pressed
qEvent.prototype.setKeyPressed = function (i) {
    var b = this.shiftKey;
    if (!b && (i > 64 && i < 91)) return this.setKP(i + 32);
    if (i > 95 && i < 106) return this.setKP(i - 48);

    switch (i) {
        case 49: case 51: case 52: case 53: if (b) i = i - 16; break;
        case 50: if (b) i = 64; break;
        case 54: if (b) i = 94; break;
        case 55: if (b) i = 38; break;
        case 56: if (b) i = 42; break;
        case 57: if (b) i = 40; break;
        case 48: if (b) i = 41; break;
        case 192: if (b) i = 126; else i = 96; break;
        case 189: if (b) i = 95; else i = 45; break;
        case 187: if (b) i = 43; else i = 61; break;
        case 220: if (b) i = 124; else i = 92; break;
        case 221: if (b) i = 125; else i = 93; break;
        case 219: if (b) i = 123; else i = 91; break;
        case 222: if (b) i = 34; else i = 39; break;
        case 186: if (b) i = 58; else i = 59; break;
        case 191: if (b) i = 63; else i = 47; break;
        case 190: if (b) i = 62; else i = 46; break;
        case 188: if (b) i = 60; else i = 44; break;

        case 106: case 57379: i = 42; break;
        case 107: case 57380: i = 43; break;
        case 109: case 57381: i = 45; break;
        case 110: i = 46; break;
        case 111: case 57378: i = 47; break;

        case 8: return this.setKP(i, "[backspace]");
        case 9: return this.setKP(i, "[tab]");
        case 13: return this.setKP(i, "[enter]");
        case 16: case 57389: return this.setKP(i, "[shift]");
        case 17: case 57390: return this.setKP(i, "[ctrl]");
        case 18: case 57388: return this.setKP(i, "[alt]");
        case 19: case 57402: return this.setKP(i, "[break]");
        case 20: return this.setKP(i, "[capslock]");
        case 32: return this.setKP(i, "[space]");
        case 91: return this.setKP(i, "[windows]");
        case 93: return this.setKP(i, "[properties]");

        case 33: case 57371: return this.setKP(i * -1, "[pgup]");
        case 34: case 57372: return this.setKP(i * -1, "[pgdown]");
        case 35: case 57370: return this.setKP(i * -1, "[end]");
        case 36: case 57369: return this.setKP(i * -1, "[home]");
        case 37: case 57375: return this.setKP(i * -1, "[left]");
        case 38: case 57373: return this.setKP(i * -1, "[up]");
        case 39: case 57376: return this.setKP(i * -1, "[right]");
        case 40: case 57374: return this.setKP(i * -1, "[down]");
        case 45: case 57382: return this.setKP(i * -1, "[insert]");
        case 46: case 57383: return this.setKP(i * -1, "[delete]");
        case 144: case 57400: return this.setKP(i * -1, "[numlock]");
    }

    if (i > 111 && i < 124) return this.setKP(i * -1, "[f" + (i - 111) + "]");

    return this.setKP(i);
}

// define the addEvent(oElement, sEvent, sCmd, bAppend) function
function $addEvent(o, _e, c, _b) {
    var e = _e.toLowerCase(), b = (typeof _b == "boolean") ? _b : true, x = (o[e]) ? o[e].toString() : "";
    // strip out the body of the function
    x = x.substring(x.indexOf("{") + 1, x.lastIndexOf("}"));
    x = ((b) ? (x + c) : (c + x)) + "\n";
    return o[e] = (!!window.Event) ? new Function("event", x) : new Function(x);
}