export const clamp = (v,a,b)=> v<a?a:(v>b?b:v);
export const rnd   = (a,b)=> a + Math.random()*(b-a);
export const byId  = id => document.getElementById(id);
