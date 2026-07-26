/**
 * Reminder Center Module
 * Client-side wedding countdown reminders with browser notifications
 */
(function(){
  'use strict';
  var W=window.__WEDDING_REMINDERS=window.__WEDDING_REMINDERS||{};
  if(W.initialized)return;
  W.initialized=true;

  var STORAGE_KEY='weddingReminders';
  var SCHEDULE_KEY='weddingReminderSchedule';

  function getReminders(){
    try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');}catch(e){return[];}
  }
  function saveReminders(r){localStorage.setItem(STORAGE_KEY,JSON.stringify(r));}
  function getSchedule(){
    try{return JSON.parse(localStorage.getItem(SCHEDULE_KEY)||'{}');}catch(e){return{};}
  }
  function saveSchedule(s){localStorage.setItem(SCHEDULE_KEY,JSON.stringify(s));}
  function getWeddingDate(){
    try{var d=JSON.parse(localStorage.getItem('weddingData')||'{}');return d.weddingDate?new Date(d.weddingDate):null;}catch(e){return null;}
  }

  W.getAll=function(){return getReminders();};

  W.add=function(reminder){
    var reminders=getReminders();
    var entry={
      id:'rem_'+Date.now()+'_'+Math.random().toString(36).substr(2,6),
      title:reminder.title||'Untitled Reminder',
      description:reminder.description||'',
      dueDate:reminder.dueDate?new Date(reminder.dueDate).toISOString():null,
      category:reminder.category||'general',
      priority:reminder.priority||'medium',
      completed:false,
      notified:false,
      createdAt:new Date().toISOString()
    };
    reminders.push(entry);
    saveReminders(reminders);
    if(window.AuditLog)window.AuditLog.record('reminder_added','Reminder: '+entry.title,'reminders');
    return entry;
  };

  W.update=function(id,updates){
    var reminders=getReminders();
    var idx=reminders.findIndex(function(r){return r.id===id;});
    if(idx===-1)return null;
    Object.keys(updates).forEach(function(k){reminders[idx][k]=updates[k];});
    saveReminders(reminders);
    return reminders[idx];
  };

  W.complete=function(id){
    return W.update(id,{completed:true,completedAt:new Date().toISOString()});
  };

  W.delete=function(id){
    var reminders=getReminders().filter(function(r){return r.id!==id;});
    saveReminders(reminders);
    return true;
  };

  W.getUpcoming=function(days){
    var reminders=getReminders();
    var cutoff=new Date();
    cutoff.setDate(cutoff.getDate()+(days||30));
    return reminders.filter(function(r){
      return!r.completed&&r.dueDate&&new Date(r.dueDate)<=cutoff;
    }).sort(function(a,b){return new Date(a.dueDate)-new Date(b.dueDate);});
  };

  W.getOverdue=function(){
    var now=new Date();
    return getReminders().filter(function(r){
      return!r.completed&&r.dueDate&&new Date(r.dueDate)<now;
    });
  };

  W.getStats=function(){
    var reminders=getReminders();
    return{
      total:reminders.length,
      completed:reminders.filter(function(r){return r.completed;}).length,
      pending:reminders.filter(function(r){return!r.completed;}).length,
      overdue:W.getOverdue().length,
      byCategory:reminders.reduce(function(acc,r){acc[r.category]=(acc[r.category]||0)+1;return acc;},{})
    };
  };

  W.generateFromTemplate=function(){
    var templates=[
      {title:'Finalize Guest List',days:90,category:'planning',priority:'high'},
      {title:'Book Venue',days:85,category:'booking',priority:'high'},
      {title:'Send Save the Dates',days:80,category:'invitations',priority:'high'},
      {title:'Book Photographer',days:75,category:'vendors',priority:'high'},
      {title:'Book Caterer',days:70,category:'vendors',priority:'high'},
      {title:'Choose Wedding Party',days:65,category:'planning',priority:'medium'},
      {title:'Book Florist',days:60,category:'vendors',priority:'medium'},
      {title:'Send Invitations',days:60,category:'invitations',priority:'high'},
      {title:'Order Wedding Cake',days:45,category:'vendors',priority:'medium'},
      {title:'Final Dress Fitting',days:30,category:'attire',priority:'high'},
      {title:'Finalize Menu',days:30,category:'catering',priority:'high'},
      {title:'Confirm RSVP Count',days:21,category:'invitations',priority:'high'},
      {title:'Create Seating Chart',days:14,category:'planning',priority:'medium'},
      {title:'Confirm Vendor Details',days:14,category:'vendors',priority:'high'},
      {title:'Write Vows',days:10,category:'personal',priority:'high'},
      {title:'Pack Honeymoon Bags',days:7,category:'personal',priority:'medium'},
      {title:'Rehearsal Dinner',days:1,category:'event',priority:'high'},
      {title:'Wedding Day!',days:0,category:'event',priority:'high'}
    ];
    var weddingDate=getWeddingDate();
    if(!weddingDate)return[];
    var added=[];
    templates.forEach(function(t){
      var due=new Date(weddingDate);
      due.setDate(due.getDate()-t.days);
      if(due>new Date()){
        var entry=W.add({title:t.title,dueDate:due.toISOString(),category:t.category,priority:t.priority,description:'Auto-generated from template'});
        added.push(entry);
      }
    });
    return added;
  };

  W.requestNotificationPermission=function(){
    if(!('Notification' in window))return false;
    if(Notification.permission==='granted')return true;
    Notification.requestPermission();
    return Notification.permission==='granted';
  };

  W.sendNotification=function(title,body,tag){
    if(!('Notification' in window)||Notification.permission!=='granted')return;
    var n=new Notification(title,{body:body,icon:'icons/icon-192.svg',tag:tag||'wedding-reminder',requireInteraction:true});
    n.onclick=function(){window.focus();n.close();};
  };

  W.checkDueReminders=function(){
    var now=new Date();
    var reminders=getReminders();
    var due=[];
    reminders.forEach(function(r){
      if(!r.completed&&!r.notified&&r.dueDate){
        var dueDate=new Date(r.dueDate);
        var diff=dueDate-now;
        if(diff<=0||diff<60*60*1000){
          due.push(r);
          r.notified=true;
        }
      }
    });
    saveReminders(reminders);
    due.forEach(function(r){
      W.sendNotification('Wedding Reminder',r.title,r.id);
    });
    return due;
  };

  W.renderRemindersPanel=function(containerId){
    var el=document.getElementById(containerId);if(!el)return;
    var reminders=getReminders();
    var stats=W.getStats();
    var overdue=W.getOverdue();
    el.innerHTML='\n'+
      '<div class="glass-card" style="padding:24px;border-radius:16px;border:1px solid rgba(212,175,55,0.08)">\n'+
      '  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">\n'+
      '    <h3 style="font-family:Playfair Display,serif;color:#D4AF37"><i class="fas fa-bell" style="margin-right:8px"></i>Reminders</h3>\n'+
      '    <div style="display:flex;gap:8px">\n'+
      '      <button onclick="WeddingReminders.requestNotificationPermission()" style="padding:6px 12px;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.15);border-radius:8px;color:#D4AF37;cursor:pointer;font-size:0.78rem"><i class="fas fa-bell"></i></button>\n'+
      '      <button onclick="WeddingReminders.showAddForm()" style="padding:6px 12px;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.15);border-radius:8px;color:#D4AF37;cursor:pointer;font-size:0.78rem"><i class="fas fa-plus"></i></button>\n'+
      '    </div>\n'+
      '  </div>\n'+
      '  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">\n'+
      '    <div style="text-align:center;padding:10px;background:rgba(255,255,255,0.02);border-radius:10px"><div style="font-size:1.2rem;color:#D4AF37;font-weight:600">'+stats.total+'</div><div style="font-size:0.7rem;color:#A09888">Total</div></div>\n'+
      '    <div style="text-align:center;padding:10px;background:rgba(255,255,255,0.02);border-radius:10px"><div style="font-size:1.2rem;color:#4CAF50;font-weight:600">'+stats.completed+'</div><div style="font-size:0.7rem;color:#A09888">Done</div></div>\n'+
      '    <div style="text-align:center;padding:10px;background:rgba(255,255,255,0.02);border-radius:10px"><div style="font-size:1.2rem;color:#FF9800;font-weight:600">'+stats.pending+'</div><div style="font-size:0.7rem;color:#A09888">Pending</div></div>\n'+
      '    <div style="text-align:center;padding:10px;background:rgba(255,255,255,0.02);border-radius:10px"><div style="font-size:1.2rem;color:#F44336;font-weight:600">'+stats.overdue+'</div><div style="font-size:0.7rem;color:#A09888">Overdue</div></div>\n'+
      '  </div>\n'+
      '  <div id="reminderList">'+renderReminderItems(reminders)+'</div>\n'+
      '  <div id="reminderAddForm" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.05)">\n'+
      '    <input id="remTitle" placeholder="Reminder title" style="width:100%;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(212,175,55,0.08);border-radius:10px;color:#E8E0D0;font-size:0.85rem;margin-bottom:8px">\n'+
      '    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">\n'+
      '      <input id="remDate" type="date" style="padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(212,175,55,0.08);border-radius:10px;color:#E8E0D0;font-size:0.85rem">\n'+
      '      <select id="remPriority" style="padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(212,175,55,0.08);border-radius:10px;color:#E8E0D0;font-size:0.85rem"><option value="low">Low Priority</option><option value="medium" selected>Medium</option><option value="high">High Priority</option></select>\n'+
      '    </div>\n'+
      '    <div style="display:flex;gap:8px">\n'+
      '      <button onclick="WeddingReminders.saveNew()" style="flex:1;padding:10px;background:linear-gradient(135deg,#D4AF37,#B8860B);border:none;border-radius:10px;color:#0B0F19;font-weight:600;cursor:pointer;font-size:0.85rem">Save</button>\n'+
      '      <button onclick="WeddingReminders.hideAddForm()" style="padding:10px 16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:#A09888;cursor:pointer">Cancel</button>\n'+
      '    </div>\n'+
      '  </div>\n'+
      '</div>\n';
    setInterval(function(){W.checkDueReminders();},60000);
  };

  function renderReminderItems(reminders){
    if(reminders.length===0)return'<p style="color:#666;font-size:0.85rem;text-align:center;padding:16px">No reminders yet. Add your first reminder!</p>';
    return reminders.sort(function(a,b){
      if(a.completed!==b.completed)return a.completed?1:-1;
      var pa={high:0,medium:1,low:2};return(pa[a.priority]||1)-(pa[b.priority]||1);
    }).map(function(r){
      var overdue=!r.completed&&r.dueDate&&new Date(r.dueDate)<new Date();
      var colors={high:'#F44336',medium:'#FF9800',low:'#4CAF50'};
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(255,255,255,0.02);border-radius:10px;margin-bottom:6px;border-left:3px solid '+(overdue?'#F44336':colors[r.priority]||'#D4AF37')+'">'+
        '<input type="checkbox" '+(r.completed?'checked':'')+' onchange="WeddingReminders.toggleComplete(\''+r.id+'\')" style="cursor:pointer;accent-color:#D4AF37">'+
        '<div style="flex:1"><p style="color:'+(r.completed?'#666':'#E8E0D0')+';font-size:0.85rem;'+(r.completed?'text-decoration:line-through':'')+'">'+escapeHTML(r.title)+'</p>'+
        '<p style="color:#666;font-size:0.72rem">'+(r.dueDate?new Date(r.dueDate).toLocaleDateString():'No date')+' &middot; '+r.category+'</p></div>'+
        '<button onclick="WeddingReminders.deleteReminder(\''+r.id+'\')" style="padding:4px 8px;background:transparent;border:none;color:#666;cursor:pointer;font-size:0.75rem"><i class="fas fa-trash"></i></button>'+
        '</div>';
    }).join('');
  }

  W.showAddForm=function(){var f=document.getElementById('reminderAddForm');if(f)f.style.display='block';};
  W.hideAddForm=function(){var f=document.getElementById('reminderAddForm');if(f)f.style.display='none';};
  W.saveNew=function(){
    var title=document.getElementById('remTitle').value;
    var date=document.getElementById('remDate').value;
    var priority=document.getElementById('remPriority').value;
    if(!title){if(typeof notify==='function')notify('Enter a reminder title','warning');return;}
    W.add({title:title,dueDate:date||null,priority:priority,category:'custom'});
    W.hideAddForm();
    W.renderRemindersPanel(document.getElementById('reminderList').parentElement.parentElement.id||'reminderPanel');
    if(typeof notify==='function')notify('Reminder added!','success');
  };
  W.toggleComplete=function(id){
    var r=getReminders().find(function(r){return r.id===id;});
    if(r){W.update(id,{completed:!r.completed});}
  };
  W.deleteReminder=function(id){
    W.delete(id);
    var panel=document.getElementById('reminderList');
    if(panel)panel.innerHTML=renderReminderItems(getReminders());
  };

  function escapeHTML(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  window.WeddingReminders=W;
  console.log('Reminder Center initialized');
})();
