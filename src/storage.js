export const storage={
  get(key){try{const v=localStorage.getItem(key);return v!==null?{value:v}:null;}catch{return null;}},
  set(key,value){try{localStorage.setItem(key,String(value));return true;}catch{return false;}},
};
