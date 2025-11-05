



export function restoreObject(objectUUID, setEntitiesRef) {
  setEntitiesRef(prev => {
    const newState = prev.map(obj => {
      return obj.id === objectUUID ? {...obj, isActive: true, show: true } : obj
    })
    return [...newState]
  })
}

export function removeAllInactiveObjects(setEntitiesRef) {
  setEntitiesRef(prev => {
    const newState = prev.filter(obj => obj.isActive)
    return [...newState]
  })
}

