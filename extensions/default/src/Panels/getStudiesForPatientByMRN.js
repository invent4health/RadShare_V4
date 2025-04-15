async function getStudiesForPatientByMRN(dataSource, qidoForStudyUID) {
  if (!qidoForStudyUID?.length) {
    return [];
  }

  const mrn = qidoForStudyUID[0].mrn;
  const patientName = qidoForStudyUID[0].patientName;

  if (!mrn) {
    return qidoForStudyUID;
  }

  const queryParams = {
    patientId: mrn,
    disableWildcard: true,
  };

  // Only include patientName if it’s safe (e.g., contains only letters and spaces)
  if (patientName && /^[a-zA-Z\s]+$/.test(patientName)) {
    queryParams.patientName = patientName;
  } else {
    console.warn(`Skipping patientName in query due to invalid format: ${patientName}`);
  }

  return dataSource.query.studies.search(queryParams);
}

export default getStudiesForPatientByMRN;
