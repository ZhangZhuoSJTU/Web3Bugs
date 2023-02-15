# Code Review Processes
## New Feature Review
Before submitting a pull request for new review, make sure the following is done:
* Design doc is created and posted here: [Insert Link]
* Code cleanliness and completeness is addressed via [guidelines](https://app.gitbook.com/@setprotocol-1/s/set/smart-contract-engineering/sc-code-review-process)

README Checks
- [] README has proper context for the reviewer to understand what the code includes, any important design considerations, and areas to pay more attention to

Code Checks
- [] Add explanatory comments. If there is complex code that requires specific context or understanding, note that in a comment
- [] Remove unncessary comments. Any comments that do not add additional context, information, etc. should be removed
- [] Add javadocs. 
- [] Scrub through the code for inconsistencies (e.g. removing extra spaces)
- [] Ensure there are not any .onlys in spec files


Broader Considerations
- [] Ensure variable, function and event naming is clear, consistent, and reflective for the scope of the code.
- [] Consider if certain pieces of logic should be placed in a different library, module
