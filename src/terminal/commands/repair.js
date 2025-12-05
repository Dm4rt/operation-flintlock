/**
 * repair command - Repair EW system components
 * Usage: repair <component>
 * Components: waterfall, spectrum, tuning
 */
export async function repair(fs, args, socket) {
  if (!args || args.length === 0) {
    return {
      output: [
        'repair: missing component argument',
        'Usage: repair <component>',
        'Available components: waterfall, spectrum, tuning'
      ].join('\n'),
      error: true
    };
  }

  const component = args[0].toLowerCase();
  const validComponents = ['waterfall', 'spectrum', 'tuning'];

  if (!validComponents.includes(component)) {
    return {
      output: [
        `repair: unknown component '${args[0]}'`,
        'Available components: waterfall, spectrum, tuning'
      ].join('\n'),
      error: true
    };
  }

  // Directly update Firestore - simpler and more reliable
  try {
    const { collection, query, where, getDocs, updateDoc } = await import('firebase/firestore');
    const { db } = await import('../../services/firebase');
    
    // Get sessionId from fs context
    const sessionId = fs.sessionId;
    if (!sessionId) {
      throw new Error('No session ID available');
    }
    
    const injectsRef = collection(db, 'sessions', sessionId, 'injects');
    const q = query(
      injectsRef,
      where('team', '==', 'ew'),
      where('type', '==', 'spectrum-outage'),
      where('status', '==', 'active')
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return {
        output: 'Error: No active spectrum outage to repair.',
        error: true
      };
    }
    
    const doc = snapshot.docs[0];
    const injectData = doc.data();
    const correctComponent = injectData.payload?.component;
    
    console.log('[repair] Found inject:', doc.id, 'correct component:', correctComponent);
    
    if (component === correctComponent) {
      // Correct component - resolve the inject
      await updateDoc(doc.ref, {
        status: 'resolved',
        resolvedBy: 'cyber',
        resolvedAt: new Date().toISOString()
      });
      
      console.log('[repair] ✅ Resolved inject:', doc.id);
      
      return {
        output: [
          `[REPAIR] Initiating repair sequence for ${component}...`,
          `[REPAIR] Running diagnostics...`,
          `[REPAIR] Restoring ${component} subsystem...`,
          `[REPAIR] ✅ ${component.toUpperCase()} successfully repaired!`,
          `[REPAIR] EW systems coming back online...`
        ].join('\n')
      };
    } else {
      // Wrong component
      console.log('[repair] ❌ Wrong component - tried', component, 'need', correctComponent);
      
      return {
        output: [
          `[REPAIR] Initiating repair sequence for ${component}...`,
          `[REPAIR] Running diagnostics...`,
          `[REPAIR] ❌ ERROR: ${component} diagnostics passed - not the problem!`,
          `[REPAIR] Try a different component.`
        ].join('\n'),
        error: true
      };
    }
  } catch (error) {
    console.error('[repair] Error:', error);
    return {
      output: `Error: Failed to communicate with server - ${error.message}`,
      error: true
    };
  }
}
