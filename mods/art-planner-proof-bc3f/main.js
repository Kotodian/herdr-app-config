// Written by herdr-artifact: the artifact (artifact-main.js) with Mark up laid over it
// (artifact-markup.js). Don't edit: it's replaced.
import Artifact from "./artifact-main.js";
import { markupInit, markupWrap } from "./artifact-markup.js";

export default class MarkedArtifact extends Artifact {
  init(props, cx) {
    if (super.init) super.init(props, cx);
    this.__herdrMark = markupInit(cx);
  }
  render(cx) {
    return markupWrap(this.__herdrMark, super.render(cx), cx);
  }
}
