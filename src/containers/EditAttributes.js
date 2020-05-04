import { connect } from 'react-redux'
import Attributes from '../components/Attributes'
import { deleteElementAttributeClass, restoreElementAttributeClass, deleteElementAttribute,
  deleteClassAttribute, restoreClassAttribute, restoreClassAttributeDeletedOnClass, changeElementAttribute,
  useClassDefault, changeClassAttribute, restoreElementAttribute, addElementAttribute } from '../actions/elements'
import { clearPicker } from '../actions/interface'
import { push } from 'react-router-redux'
import {clone} from '../utils/clone'

const mapStateToProps = (state, ownProps) => {
  const element = clone(ownProps.element)
  const localElement = state.odd.localsource.json.elements.filter(le => (le.ident === element.ident))[0]

  let deletedAttributesFromClasses = new Set()

  const getClasses = (classNames, sub = false, from = '') => {
    // Get attribute classes
    return classNames.reduce((acc, className) => {
      const localClass = state.odd.localsource.json.classes.attributes.filter((lc) => (lc.ident === className))[0]
      const c = state.odd.customization.json.classes.attributes.filter(ac => (ac.ident === className))[0]
      if (c) {
        let tempAcc = Array.from(acc)
        // clone class
        const curClass = clone(c)
        curClass.sub = sub
        curClass.from = from
        curClass.deletedAttributes = new Set()

        // We check against the localsource to obtain attributes that have been deleted
        // (ie do not appear in customization)
        if (localClass) {
          for (const localAtt of localClass.attributes) {
            if (!c.attributes.filter((a) => (a.ident === localAtt.ident))[0]) {
              curClass.deletedAttributes.add(localAtt.ident)
              curClass.attributes.push(Object.assign({}, localAtt, {mode: 'delete', deleted: true, overridden: false, deletedOnClass: true}))
            }
          }
        }
        // Deal with wrongly removed attributes (e.g. they don't exist in the localclass or customization)
        for (const att of curClass.attributes) {
          if (att.mode === 'delete') {
            if (!localClass.attributes.filter(a => (a.ident === att.ident))[0]) {
              att.noeffect = true
            }
          }
        }

        // Check if a definition in the element overrides or deletes an inhereted attribute
        for (const att of curClass.attributes) {
          const redefinedAtt = element.attributes.filter((a) => (a.ident === att.ident))[0]
          if (redefinedAtt) {
            att.overridden = false
            att.deleted = false
            att.mode = redefinedAtt.mode
            if (redefinedAtt.mode === 'delete') {
              att.deleted = true
              curClass.deletedAttributes.add(att.ident)
            } else if (redefinedAtt.mode === 'change' || redefinedAtt.mode === 'add') {
              curClass.deletedAttributes.delete(att.ident)
              if (redefinedAtt._changed === undefined || redefinedAtt._changed.length > 0) {
                att.overridden = true
              }
            }
          }
        }
        if (curClass.deletedAttributes.size >= curClass.attributes.length) {
          curClass.inactive = true
        }
        tempAcc.push(curClass)
        // Get inherited classes from both customization and localsource
        const subClasses = curClass.classes ? new Set(curClass.classes.atts) : new Set()
        if (localClass && localClass.classes) {
          for (const cl of localClass.classes.atts) {
            subClasses.add(cl)
          }
        }
        if (subClasses.size > 0) {
          tempAcc = tempAcc.concat(getClasses(Array.from(subClasses), true, curClass.ident))
        }

        // store list of deleted attribures
        deletedAttributesFromClasses = new Set([...deletedAttributesFromClasses, ...curClass.deletedAttributes])
        return tempAcc
      }

      return acc
    }, [])
  }

  // Get attribute classes
  let attsfromClasses = []

  if (element.classes) {
    attsfromClasses = getClasses(element.classes.atts)
  }

  // Sort classes based on active/inactive
  attsfromClasses.sort((a, b) => {
    return a.ident > b.ident
  })

  for (const att of element.attributes) {
    // Check for deleted attributes that were defined on the element only
    // ie are not inherited from a class.
    if (att.mode === 'delete' && att.onElement && att._isNew) {
      att.shortDesc = localElement.attributes.filter(a => (a.ident === att.ident))[0].shortDesc
      att.deleted = true
    } else if (deletedAttributesFromClasses.has(att.ident)) {
      // Skip this attribute if it's modifying a class element
      att.onElement = false
    }
  }

  // Sort element attributes
  element.attributes.sort((a, b) => {
    return a.ident > b.ident
  })

  return {member: element, memberType: 'element', attsfromClasses, path: state.router.location.pathname}
}

const mapDispatchToProps = (dispatch) => {
  return {
    navigateTo: (place) => dispatch(push(place)),
    deleteMemberAttribute: (element, attribute) => dispatch(deleteElementAttribute(element, attribute)),
    restoreMemberAttribute: (element, attribute) => dispatch(restoreElementAttribute(element, attribute)),
    deleteElementAttributeClass: (element, className) => dispatch(deleteElementAttributeClass(element, className)),
    clearPicker: () => dispatch(clearPicker()),
    restoreElementAttributeClass: (element, className, deletedAttributes) => dispatch(restoreElementAttributeClass(element, className, deletedAttributes)),
    deleteClassAttribute: (element, className, attName) => dispatch(deleteClassAttribute(element, className, attName)),
    restoreClassAttribute: (element, attName) => dispatch(restoreClassAttribute(element, attName)),
    editAttribute: (element, attName, path) => {
      dispatch(changeElementAttribute(element, attName))
      dispatch(push(`${path}/${attName}`))
    },
    editClassAttribute: (element, className, attName, path) => {
      dispatch(changeClassAttribute(element, className, attName))
      dispatch(push(`${path}/${attName}`))
    },
    restoreClassAttributeDeletedOnClass: (element, className, attName) => {
      dispatch(restoreClassAttributeDeletedOnClass(element, className, attName))
    },
    useClassDefault: (element, attName) => dispatch(useClassDefault(element, attName)),
    addMemberAttribute: (element, attribute) => addElementAttribute(element, attribute)
  }
}

const EditAttributes = connect(
  mapStateToProps,
  mapDispatchToProps
)(Attributes)

export default EditAttributes
