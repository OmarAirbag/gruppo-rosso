'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = 'https://gtnywpljxuuzuzyhfonh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0bnl3cGxqeHV1enV6eWhmb25oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTgyOTUsImV4cCI6MjA4NTI3NDI5NX0._SnOahC28xmjLDU5lNS794GK9abt6cqyJQCcJAiSn6M';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PARTICIPANTS = {
  men: ['Omar', 'Luca', 'Ivan', 'Maurizio', 'Marcello', 'Andrea'],
  women: ['Sabrina', 'Fabrizia', 'Lucia', 'Ilaria', 'Giovanna', 'Giulia', 'Chiara']
};

const DEFAULT_SCENES = ['I+III', 'V', 'VI', 'XVI', 'XVII', 'XII'];
const DATA_ID = 'gruppo_rosso';

const parseLocalDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const generateDates = () => {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const endYear = currentMonth > 2 ? currentYear + 1 : currentYear;
  const end = new Date(endYear, 2, 31);
  
  for (let d = new Date(twoWeeksAgo); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day === 1 || day === 3) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${dayNum}`);
    }
  }
  
  const todayTime = today.getTime();
  
  dates.sort((a, b) => {
    const dateA = parseLocalDate(a).getTime();
    const dateB = parseLocalDate(b).getTime();
    const aIsFuture = dateA >= todayTime;
    const bIsFuture = dateB >= todayTime;
    
    if (aIsFuture && !bIsFuture) return -1;
    if (!aIsFuture && bIsFuture) return 1;
    
    if (aIsFuture && bIsFuture) {
      return dateA - dateB;
    } else {
      return dateB - dateA;
    }
  });
  
  return dates;
};

const AVAILABLE_DATES = generateDates();

export default function SceneMatcher() {
  const [slots, setSlots] = useState({});
  const [selectedDate, setSelectedDate] = useState(AVAILABLE_DATES[0] || '');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [history, setHistory] = useState([]);
  const [skippedDates, setSkippedDates] = useState([]);
  const [scenes, setScenes] = useState(DEFAULT_SCENES);
  const [showScenesModal, setShowScenesModal] = useState(false);
  const [newSceneText, setNewSceneText] = useState('');
  const [viewMode, setViewMode] = useState('assign');
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('loading');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setSyncStatus('loading');
      const { data, error } = await supabase
        .from('scene_matcher_data')
        .select('*')
        .eq('id', DATA_ID)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          const { error: insertError } = await supabase
            .from('scene_matcher_data')
            .insert({ id: DATA_ID });
          if (insertError) throw insertError;
        } else {
          throw error;
        }
      }

      if (data) {
        setSlots(data.slots || {});
        setHistory(data.history || []);
        setSkippedDates(data.skipped_dates || []);
        setScenes(data.scenes || DEFAULT_SCENES);
        setLastUpdate(data.updated_at);
      }
      setSyncStatus('synced');
    } catch (e) {
      console.error('Error loading:', e);
      setSyncStatus('error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel('scene_matcher_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scene_matcher_data',
          filter: `id=eq.${DATA_ID}`
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          const data = payload.new;
          setSlots(data.slots || {});
          setHistory(data.history || []);
          setSkippedDates(data.skipped_dates || []);
          setScenes(data.scenes || DEFAULT_SCENES);
          setLastUpdate(data.updated_at);
          setSyncStatus('synced');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const saveData = async (newSlots, newHistory, newSkippedDates, newScenes = scenes) => {
    try {
      setSyncStatus('saving');
      const { error } = await supabase
        .from('scene_matcher_data')
        .update({
          slots: newSlots,
          history: newHistory,
          skipped_dates: newSkippedDates,
          scenes: newScenes,
          updated_at: new Date().toISOString()
        })
        .eq('id', DATA_ID);

      if (error) throw error;
      setSyncStatus('synced');
    } catch (e) {
      console.error('Error saving:', e);
      setSyncStatus('error');
    }
  };

  const getConfirmedScenesForDate = (date) => {
    return history.filter(h => h.date === date);
  };

  const getAvailableSlotsCount = (date) => {
    const confirmed = getConfirmedScenesForDate(date).length;
    return Math.max(0, 3 - confirmed);
  };

  const getDateSlots = () => {
    return slots[selectedDate] || {
      slot1: { person1: null, person2: null, scene: null },
      slot2: { person1: null, person2: null, scene: null },
      slot3: { person1: null, person2: null, scene: null }
    };
  };

  const formatDate = (dateStr) => {
    const date = parseLocalDate(dateStr);
    const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const getPersonSceneCount = (name) => {
    return history.filter(h => h.person1 === name || h.person2 === name).length;
  };

  const isPersonInPendingSlot = (name, date) => {
    const dateSlots = slots[date];
    if (!dateSlots) return false;
    return Object.values(dateSlots).some(
      slot => slot.person1 === name || slot.person2 === name
    );
  };

  const isPersonInConfirmedHistory = (name, date) => {
    return history.some(h => h.date === date && (h.person1 === name || h.person2 === name));
  };

  const isPersonAssignedToDate = (name, date) => {
    return isPersonInPendingSlot(name, date) || isPersonInConfirmedHistory(name, date);
  };

  const canAssignPerson = (name) => {
    if (isPersonAssignedToDate(name, selectedDate)) return false;
    return true;
  };

  const isMale = (name) => PARTICIPANTS.men.includes(name);
  const isFemale = (name) => PARTICIPANTS.women.includes(name);

  const canPairWith = (person1, person2) => {
    if (!person1 || !person2) return true;
    if (isMale(person1) && isMale(person2)) return false;
    return true;
  };

  const handlePersonClick = (name) => {
    if (!canAssignPerson(name)) return;
    setSelectedPerson(name);
  };

  const handleSlotClick = (slotId, position) => {
    if (!selectedPerson) return;
    
    const dateSlots = getDateSlots();
    const slot = dateSlots[slotId];
    
    const otherPosition = position === 'person1' ? 'person2' : 'person1';
    const otherPerson = slot[otherPosition];
    
    if (!canPairWith(selectedPerson, otherPerson)) {
      alert('Gli uomini possono fare coppia solo con le donne!');
      return;
    }
    
    const newSlots = {
      ...slots,
      [selectedDate]: {
        ...dateSlots,
        [slotId]: {
          ...slot,
          [position]: selectedPerson
        }
      }
    };
    
    setSlots(newSlots);
    setSelectedPerson(null);
    saveData(newSlots, history, skippedDates);
  };

  const removeFromSlot = (slotId, position) => {
    const dateSlots = getDateSlots();
    const newSlots = {
      ...slots,
      [selectedDate]: {
        ...dateSlots,
        [slotId]: {
          ...dateSlots[slotId],
          [position]: null
        }
      }
    };
    setSlots(newSlots);
    saveData(newSlots, history, skippedDates);
  };

  const updateSlotScene = (slotId, scene) => {
    const dateSlots = getDateSlots();
    const newSlots = {
      ...slots,
      [selectedDate]: {
        ...dateSlots,
        [slotId]: {
          ...dateSlots[slotId],
          scene
        }
      }
    };
    setSlots(newSlots);
    saveData(newSlots, history, skippedDates);
  };

  const confirmSlot = (slotId) => {
    const dateSlots = getDateSlots();
    const slot = dateSlots[slotId];
    
    if (!slot.person1 || !slot.person2 || !slot.scene) return;
    
    const newHistoryEntry = {
      date: selectedDate,
      person1: slot.person1,
      person2: slot.person2,
      scene: slot.scene,
      confirmedAt: new Date().toISOString()
    };
    
    const newHistory = [...history, newHistoryEntry];
    
    const newSlots = {
      ...slots,
      [selectedDate]: {
        ...dateSlots,
        [slotId]: { person1: null, person2: null, scene: null }
      }
    };
    
    setHistory(newHistory);
    setSlots(newSlots);
    saveData(newSlots, newHistory, skippedDates);
  };

  const toggleSkipDate = (date) => {
    let newSkippedDates;
    if (skippedDates.includes(date)) {
      newSkippedDates = skippedDates.filter(d => d !== date);
    } else {
      newSkippedDates = [...skippedDates, date];
    }
    setSkippedDates(newSkippedDates);
    saveData(slots, history, newSkippedDates);
  };

  const isDateSkipped = (date) => skippedDates.includes(date);

  const addScene = () => {
    const trimmed = newSceneText.trim();
    if (!trimmed) return;
    if (scenes.includes(trimmed)) {
      alert('Questa scena esiste già');
      return;
    }
    const newScenes = [...scenes, trimmed];
    setScenes(newScenes);
    setNewSceneText('');
    saveData(slots, history, skippedDates, newScenes);
  };

  const removeScene = (sceneToRemove) => {
    const isUsed = history.some(h => h.scene === sceneToRemove);
    if (isUsed) {
      alert('Non puoi eliminare una scena già utilizzata nello storico');
      return;
    }
    const newScenes = scenes.filter(s => s !== sceneToRemove);
    setScenes(newScenes);
    saveData(slots, history, skippedDates, newScenes);
  };

  const deleteHistoryEntry = (entryToDelete) => {
    const newHistory = history.filter(h => 
      !(h.date === entryToDelete.date && 
        h.person1 === entryToDelete.person1 && 
        h.person2 === entryToDelete.person2 && 
        h.scene === entryToDelete.scene &&
        h.confirmedAt === entryToDelete.confirmedAt)
    );
    setHistory(newHistory);
    saveData(slots, newHistory, skippedDates);
  };

  const clearAllData = async () => {
    setShowDeleteConfirm(false);
    setSlots({});
    setHistory([]);
    setSkippedDates([]);
    setScenes(DEFAULT_SCENES);
    setSelectedPerson(null);
    
    try {
      await supabase
        .from('scene_matcher_data')
        .update({
          slots: {},
          history: [],
          skipped_dates: [],
          scenes: DEFAULT_SCENES,
          updated_at: new Date().toISOString()
        })
        .eq('id', DATA_ID);
    } catch (e) {
      console.error('Error clearing:', e);
    }
  };

  const SyncIndicator = () => {
    const statusConfig = {
      loading: { color: 'bg-yellow-400', text: 'Caricamento...', animate: true },
      synced: { color: 'bg-green-400', text: 'Sincronizzato', animate: false },
      saving: { color: 'bg-blue-400', text: 'Salvataggio...', animate: true },
      error: { color: 'bg-red-400', text: 'Errore connessione', animate: false }
    };
    
    const config = statusConfig[syncStatus];
    
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <div className={`w-2 h-2 rounded-full ${config.color} ${config.animate ? 'animate-pulse' : ''}`} />
        <span>{config.text}</span>
        {syncStatus === 'error' && (
          <button 
            onClick={loadData}
            className="text-blue-500 hover:text-blue-700 underline"
          >
            Riprova
          </button>
        )}
      </div>
    );
  };

  const PersonCard = ({ name, inSlot = false, slotId = null, position = null }) => {
    const sceneCount = getPersonSceneCount(name);
    const isSelected = selectedPerson === name;
    const isAssigned = isPersonAssignedToDate(name, selectedDate);
    const male = isMale(name);
    
    if (inSlot) {
      return (
        <div className={`flex items-center justify-between p-2 rounded-lg ${
          male ? 'bg-blue-100' : 'bg-pink-100'
        }`}>
          <span className="font-medium text-sm">{name}</span>
          <button 
            onClick={() => removeFromSlot(slotId, position)}
            className="text-red-500 hover:text-red-700 text-xs"
          >
            ✕
          </button>
        </div>
      );
    }
    
    return (
      <div
        onClick={() => handlePersonClick(name)}
        className={`p-3 rounded-xl cursor-pointer transition-all ${
          isAssigned 
            ? 'bg-gray-200 opacity-50 cursor-not-allowed' 
            : isSelected 
              ? 'ring-2 ring-offset-2 ring-red-500 transform scale-105' 
              : 'hover:shadow-md hover:scale-102'
        } ${male ? 'bg-blue-100 hover:bg-blue-200' : 'bg-pink-100 hover:bg-pink-200'}`}
      >
        <div className="font-medium text-sm">{name}</div>
        <div className="text-xs text-gray-500 mt-1">{sceneCount} scene</div>
      </div>
    );
  };

  const EmptySlotPosition = ({ slotId, position, label }) => (
    <div
      onClick={() => handleSlotClick(slotId, position)}
      className={`p-2 rounded-lg border-2 border-dashed text-center text-sm cursor-pointer transition-all ${
        selectedPerson 
          ? 'border-red-400 bg-red-50 hover:bg-red-100' 
          : 'border-gray-300 text-gray-400'
      }`}
    >
      {selectedPerson ? `+ ${selectedPerson}` : label}
    </div>
  );

  const Slot = ({ slotId, title }) => {
    const dateSlots = getDateSlots();
    const slot = dateSlots[slotId];
    const isComplete = slot.person1 && slot.person2 && slot.scene;
    
    return (
      <div className={`bg-white rounded-xl p-4 shadow-md border-2 ${
        isComplete ? 'border-green-300' : 'border-gray-200'
      }`}>
        <h3 className="font-semibold text-gray-700 mb-3 text-center">{title}</h3>
        
        <div className="space-y-2 mb-3">
          {slot.person1 ? (
            <PersonCard name={slot.person1} inSlot={true} slotId={slotId} position="person1" />
          ) : (
            <EmptySlotPosition slotId={slotId} position="person1" label="Persona 1" />
          )}
          
          <div className="text-center text-gray-400 text-xs">+</div>
          
          {slot.person2 ? (
            <PersonCard name={slot.person2} inSlot={true} slotId={slotId} position="person2" />
          ) : (
            <EmptySlotPosition slotId={slotId} position="person2" label="Persona 2" />
          )}
        </div>
        
        <select
          value={slot.scene || ''}
          onChange={(e) => updateSlotScene(slotId, e.target.value)}
          className="w-full p-2 text-sm rounded border border-gray-300 mb-3"
        >
          <option value="">-- Seleziona Scena --</option>
          {scenes.map(s => (
            <option key={s} value={s}>Scena {s}</option>
          ))}
        </select>
        
        <button
          onClick={() => confirmSlot(slotId)}
          disabled={!isComplete}
          className={`w-full py-2 rounded font-medium transition-all ${
            isComplete 
              ? 'bg-green-500 text-white hover:bg-green-600' 
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          ✓ Conferma e Registra
        </button>
      </div>
    );
  };

  const HistoryView = () => {
    const allPeople = [...PARTICIPANTS.men, ...PARTICIPANTS.women];
    
    const getPartnerCounts = (name) => {
      const partners = {};
      history.forEach(h => {
        if (h.person1 === name) {
          partners[h.person2] = (partners[h.person2] || 0) + 1;
        } else if (h.person2 === name) {
          partners[h.person1] = (partners[h.person1] || 0) + 1;
        }
      });
      return partners;
    };

    const sortedHistory = [...history].sort((a, b) => {
      const dateA = parseLocalDate(a.date).getTime();
      const dateB = parseLocalDate(b.date).getTime();
      return dateB - dateA;
    });

    const groupedByDate = sortedHistory.reduce((acc, entry) => {
      if (!acc[entry.date]) acc[entry.date] = [];
      acc[entry.date].push(entry);
      return acc;
    }, {});

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">📊 Statistiche per Persona</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {allPeople.map(person => {
              const count = getPersonSceneCount(person);
              const partners = getPartnerCounts(person);
              const male = isMale(person);
              return (
                <div key={person} className={`p-3 rounded-lg ${male ? 'bg-blue-50' : 'bg-pink-50'}`}>
                  <div className="font-medium">{person}</div>
                  <div className="text-2xl font-bold text-gray-700">{count}</div>
                  <div className="text-xs text-gray-500">scene totali</div>
                  {Object.keys(partners).length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      {Object.entries(partners).map(([p, c]) => (
                        <div key={p}>{p}: {c}x</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">📅 Timeline</h2>
          {Object.keys(groupedByDate).length === 0 ? (
            <p className="text-gray-500">Nessuna scena registrata ancora.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedByDate).map(([date, entries]) => (
                <div key={date} className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 mb-2">{formatDate(date)}</h3>
                  <div className="space-y-2">
                    {entries.map((entry, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-sm bg-white p-2 rounded-lg">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-red-100 text-red-700 px-2 py-1 rounded">
                            Scena {entry.scene}
                          </span>
                          <span>{entry.person1}</span>
                          <span className="text-gray-400">+</span>
                          <span>{entry.person2}</span>
                        </div>
                        <button
                          onClick={() => {
                            if (window.confirm(`Eliminare la scena ${entry.scene} con ${entry.person1} + ${entry.person2}?\n\nLo slot tornerà disponibile per la riassegnazione.`)) {
                              deleteHistoryEntry(entry);
                            }
                          }}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                          title="Elimina e riabilita slot"
                        >
                          ✏️
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento dati...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-red-500 via-red-600 to-red-800 flex items-center justify-center shadow-lg">
                <span className="text-2xl">🎭</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-red-700">Gruppo Rosso</h1>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500">Teatro Cast - Scene Matcher</p>
                  <SyncIndicator />
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowScenesModal(true)}
                className="px-4 py-2 rounded-lg font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-all"
              >
                🎬 Scene ({scenes.length})
              </button>
              <button
                onClick={() => setViewMode('assign')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  viewMode === 'assign' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                📋 Assegna
              </button>
              <button
                onClick={() => setViewMode('history')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  viewMode === 'history' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                📊 Storico
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 rounded-lg font-medium bg-red-100 text-red-600 hover:bg-red-200"
              >
                🗑️
              </button>
            </div>
          </div>

          {showScenesModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-800">🎬 Gestione Scene</h2>
                  <button 
                    onClick={() => setShowScenesModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newSceneText}
                    onChange={(e) => setNewSceneText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addScene()}
                    placeholder="Nome nuova scena..."
                    className="flex-1 p-2 border rounded-lg"
                  />
                  <button
                    onClick={addScene}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    + Aggiungi
                  </button>
                </div>
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {scenes.map((scene, index) => {
                    const usageCount = history.filter(h => h.scene === scene).length;
                    return (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                        <span className="font-medium">Scena {scene}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-gray-200 px-2 py-1 rounded-full">
                            {usageCount} volte
                          </span>
                          {usageCount === 0 && (
                            <button
                              onClick={() => removeScene(scene)}
                              className="text-red-500 hover:text-red-700 text-sm"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-4 pt-4 border-t text-xs text-gray-500">
                  💡 Puoi eliminare solo le scene non ancora utilizzate nello storico
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">⚠️</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-800 mb-2">Conferma Reset</h2>
                  <p className="text-gray-600 mb-6">
                    Sei sicuro di voler cancellare <strong>TUTTI</strong> i dati?
                    <br />
                    <span className="text-red-500 text-sm">Questa azione non può essere annullata!</span>
                  </p>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
                    >
                      ✕ Annulla
                    </button>
                    <button
                      onClick={clearAllData}
                      className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-all"
                    >
                      🗑️ Elimina tutto
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'assign' ? (
            <>
              <div className="mb-6">
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full md:w-72 p-2 border rounded-lg text-lg"
                >
                  {(() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const todayTime = today.getTime();
                    
                    let lastWasFuture = null;
                    
                    return AVAILABLE_DATES.map((date) => {
                      const dateTime = parseLocalDate(date).getTime();
                      const isFuture = dateTime >= todayTime;
                      
                      const elements = [];
                      
                      if (lastWasFuture === true && !isFuture) {
                        elements.push(
                          <option key="separator" disabled>──── Date passate ────</option>
                        );
                      }
                      
                      lastWasFuture = isFuture;
                      
                      const skipped = isDateSkipped(date);
                      
                      elements.push(
                        <option key={date} value={date}>
                          {skipped ? '❌ ' : ''}{formatDate(date)} {isFuture ? '→' : ''}
                        </option>
                      );
                      
                      return elements;
                    });
                  })()}
                </select>
              </div>

              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDateSkipped(selectedDate)}
                    onChange={() => toggleSkipDate(selectedDate)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-gray-600">Nessuna lezione in questa data</span>
                </label>
              </div>

              {isDateSkipped(selectedDate) ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">❌</div>
                  <p>Nessuna lezione programmata per questa data</p>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold mb-3">👥 Partecipanti</h2>
                    {selectedPerson && (
                      <div className="mb-2 text-sm text-red-600">
                        Selezionato: <strong>{selectedPerson}</strong> - Clicca su uno slot per assegnarlo
                        <button 
                          onClick={() => setSelectedPerson(null)}
                          className="ml-2 text-gray-500 hover:text-gray-700"
                        >
                          (annulla)
                        </button>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {[...PARTICIPANTS.men, ...PARTICIPANTS.women].map(name => (
                        <PersonCard key={name} name={name} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold mb-3">
                      🎬 Slot per {formatDate(selectedDate)}
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        ({getAvailableSlotsCount(selectedDate)} disponibili)
                      </span>
                    </h2>
                    
                    {getConfirmedScenesForDate(selectedDate).length > 0 && (
                      <div className="mb-4 p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-700 font-medium mb-2">✓ Scene già confermate:</p>
                        <div className="flex flex-wrap gap-2">
                          {getConfirmedScenesForDate(selectedDate).map((h, i) => (
                            <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                              {h.scene}: {h.person1} + {h.person2}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {getAvailableSlotsCount(selectedDate) === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-4xl mb-2">✅</div>
                        <p>Tutti gli slot per questa data sono stati utilizzati!</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {getAvailableSlotsCount(selectedDate) >= 1 && <Slot slotId="slot1" title="Slot 1" />}
                        {getAvailableSlotsCount(selectedDate) >= 2 && <Slot slotId="slot2" title="Slot 2" />}
                        {getAvailableSlotsCount(selectedDate) >= 3 && <Slot slotId="slot3" title="Slot 3" />}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <HistoryView />
          )}
        </div>
      </div>
    </div>
  );
}
